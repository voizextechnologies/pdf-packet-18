import { PDFDocument, rgb, StandardFonts, PageSizes } from 'pdf-lib'

export interface Env {
  // Define your environment variables here
}

interface ProjectData {
  projectName: string;
  submittedTo: string;
  preparedBy: string;
  date: string;
  projectNumber?: string;
  emailAddress: string;
  phoneNumber: string;
  product: string;
  productType?: string; // 'structural-floor' or 'underlayment'
  status: {
    forReview: boolean;
    forApproval: boolean;
    forRecord: boolean;
    forInformationOnly: boolean;
  };
  submittalType: {
    tds: boolean;
    threePartSpecs: boolean;
    testReportIccEsr5194: boolean;
    testReportIccEsl1645: boolean;
    fireAssembly: boolean;
    fireAssembly01: boolean;
    fireAssembly02: boolean;
    fireAssembly03: boolean;
    msds: boolean;
    leedGuide: boolean;
    installationGuide: boolean;
    warranty: boolean;
    samples: boolean;
    other: boolean;
    otherText?: string;
  };
}

interface DocumentRequest {
  id: string;
  name: string;
  url: string;
  type: string;
  fileData?: string; // Base64 encoded file data (for uploaded documents)
}

interface GeneratePacketRequest {
  projectData: ProjectData;
  documents: DocumentRequest[];
  selectedDocumentNames?: string[]; // Selected document names (checked)
  allAvailableDocuments?: string[]; // All documents from category (checked or unchecked)
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // Handle CORS
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    }

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders })
    }

    if (request.method === 'POST' && new URL(request.url).pathname === '/generate-packet') {
      try {
        const { projectData, documents, selectedDocumentNames, allAvailableDocuments }: GeneratePacketRequest = await request.json()

        console.log(`Generating packet for: ${projectData.projectName}`)
        console.log(`Processing ${documents.length} documents`)

        // Load the template PDF and fill it
        const finalPdf = await loadAndFillTemplate(projectData, selectedDocumentNames || [], allAvailableDocuments || [])

        // Add product information page after cover page
        await addProductInfoPage(finalPdf, projectData)

        let currentPageNumber = finalPdf.getPageCount() + 1 // Start after template pages

        // Process each document
        for (const doc of documents) {
          try {
            console.log(`Processing: ${doc.name}`)

            // Add divider page
            await addDividerPage(finalPdf, doc.name, doc.type, currentPageNumber)
            currentPageNumber++

            // Get PDF bytes - either from fileData or URL
            let pdfBytes: ArrayBuffer | null = null
            
            if (doc.fileData) {
              // Uploaded document - decode base64
              console.log(`Loading document from embedded data: ${doc.name}`)
              try {
                const binaryString = atob(doc.fileData)
                const bytes = new Uint8Array(binaryString.length)
                for (let i = 0; i < binaryString.length; i++) {
                  bytes[i] = binaryString.charCodeAt(i)
                }
                pdfBytes = bytes.buffer
                console.log(`Decoded ${pdfBytes.byteLength} bytes from base64`)
              } catch (decodeError) {
                console.error(`Failed to decode base64 data for ${doc.name}:`, decodeError)
                pdfBytes = null
              }
            } else if (doc.url) {
              // Legacy document - fetch from URL
              console.log(`Fetching document from URL: ${doc.url}`)
              pdfBytes = await fetchPDF(doc.url)
            }

            if (pdfBytes) {
              const sourcePdf = await PDFDocument.load(pdfBytes)
              const pageIndices = sourcePdf.getPageIndices()

              // Copy pages one by one for better error handling
              for (let i = 0; i < pageIndices.length; i++) {
                try {
                  const [copiedPage] = await finalPdf.copyPages(sourcePdf, [pageIndices[i]])
                  finalPdf.addPage(copiedPage)
                  currentPageNumber++
                } catch (pageError) {
                  console.warn(`Failed to copy page ${i + 1} from ${doc.name}:`, pageError)
                  // Add error page instead
                  await addErrorPage(finalPdf, doc.name, `Page ${i + 1} could not be processed`)
                  currentPageNumber++
                }
              }

              console.log(`Successfully processed ${pageIndices.length} pages from ${doc.name}`)
            } else {
              // Add error page if PDF couldn't be loaded
              await addErrorPage(finalPdf, doc.name, 'Document could not be loaded')
              currentPageNumber++
            }
          } catch (docError) {
            console.error(`Error processing ${doc.name}:`, docError)
            await addErrorPage(finalPdf, doc.name, 'Document processing failed')
            currentPageNumber++
          }
        }

        // Add page numbers to all pages
        await addPageNumbers(finalPdf)

        // Generate final PDF
        const pdfBytes = await finalPdf.save()

        console.log(`Packet generated successfully: ${pdfBytes.length} bytes`)

        return new Response(pdfBytes, {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="${projectData.projectName.replace(/[^a-zA-Z0-9]/g, '_')}_Packet.pdf"`,
            'Content-Length': pdfBytes.length.toString(),
          },
        })

      } catch (error) {
        console.error('Error generating packet:', error)
        return new Response(JSON.stringify({
          error: 'Failed to generate packet',
          details: error instanceof Error ? error.message : 'Unknown error'
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    return new Response('PDF Packet Generator Worker', {
      headers: corsHeaders,
    })
  },
}

async function fetchPDF(url: string): Promise<ArrayBuffer | null> {
  try {
    // Convert relative URL to properly encoded GitHub raw URL
    let fullUrl = url
    if (!url.startsWith('http')) {
      // Remove leading slash if present
      const cleanPath = url.startsWith('/') ? url.substring(1) : url
      // Properly encode the URL components
      const encodedPath = encodeURIComponent(cleanPath).replace(/%2F/g, '/')
      fullUrl = `https://raw.githubusercontent.com/karthikeyanasha24/pdf-packet-6/main/public/${encodedPath}`
    }

    console.log(`Fetching PDF from: ${fullUrl}`)

    const response = await fetch(fullUrl, {
      headers: {
        'User-Agent': 'PDF-Packet-Generator/1.0',
      }
    })

    if (!response.ok) {
      console.error(`Failed to fetch PDF: ${response.status} ${response.statusText}`)
      console.error(`URL attempted: ${fullUrl}`)
      return null
    }

    const arrayBuffer = await response.arrayBuffer()
    console.log(`PDF fetched successfully: ${arrayBuffer.byteLength} bytes`)
    return arrayBuffer
  } catch (error) {
    console.error(`Error fetching PDF from ${url}:`, error)
    return null
  }
}

async function loadAndFillTemplate(projectData: ProjectData, selectedDocumentNames: string[], allAvailableDocuments: string[]): Promise<PDFDocument> {
  try {
    // Fetch the template PDF from GitHub
    const templateUrl = 'https://raw.githubusercontent.com/karthikeyanasha24/pdf-packet-6/main/PDF-TEMPLATE/Submittal%20Form_Floor%20Panels.pdf'
    console.log('Fetching template PDF from:', templateUrl)

    const response = await fetch(templateUrl, {
      headers: {
        'User-Agent': 'PDF-Packet-Generator/1.0',
      }
    })

    if (!response.ok) {
      console.error(`Failed to fetch template: ${response.status} ${response.statusText}`)
      // Fallback to creating a custom cover page
      const pdf = await PDFDocument.create()
      await addCoverPage(pdf, projectData, selectedDocumentNames, allAvailableDocuments)
      return pdf
    }

    const templateBytes = await response.arrayBuffer()
    console.log(`Template fetched successfully: ${templateBytes.byteLength} bytes`)

    // Load the template PDF
    const pdfDoc = await PDFDocument.load(templateBytes)

    // Get the form from the template
    const form = pdfDoc.getForm()
    const fields = form.getFields()

    console.log(`Template has ${fields.length} form fields`)
    fields.forEach(field => {
      console.log(`Field: ${field.getName()} - Type: ${field.constructor.name}`)
    })

    // Fill in the form fields
    try {
      // Try to fill fields by their names (common field names in PDF forms)
      const fieldMappings = [
        { names: ['Submitted To', 'submittedTo', 'submitted_to'], value: projectData.submittedTo },
        { names: ['Project Name', 'projectName', 'project_name'], value: projectData.projectName },
        { names: ['Project Number', 'projectNumber', 'project_number'], value: projectData.projectNumber || '' },
        { names: ['Prepared By', 'preparedBy', 'prepared_by'], value: projectData.preparedBy },
        { names: ['Phone/Email', 'phoneEmail', 'phone_email', 'PhoneEmail'], value: `${projectData.phoneNumber} / ${projectData.emailAddress}` },
        { names: ['Date', 'date'], value: projectData.date },
      ]

      fieldMappings.forEach(mapping => {
        for (const fieldName of mapping.names) {
          try {
            const field = form.getTextField(fieldName)
            if (field) {
              field.setText(mapping.value)
              console.log(`Set field ${fieldName} to: ${mapping.value}`)
              break
            }
          } catch (e) {
            // Field doesn't exist or isn't a text field, try next name
          }
        }
      })

      // Handle checkboxes for Status/Action
      const statusCheckboxes = [
        { names: ['For Review', 'forReview', 'for_review'], value: projectData.status.forReview },
        { names: ['For Approval', 'forApproval', 'for_approval'], value: projectData.status.forApproval },
        { names: ['For Record', 'forRecord', 'for_record'], value: projectData.status.forRecord },
        { names: ['For Information Only', 'forInformationOnly', 'for_information_only'], value: projectData.status.forInformationOnly },
      ]

      statusCheckboxes.forEach(mapping => {
        for (const fieldName of mapping.names) {
          try {
            const checkbox = form.getCheckBox(fieldName)
            if (checkbox) {
              if (mapping.value) {
                checkbox.check()
              } else {
                checkbox.uncheck()
              }
              console.log(`Set checkbox ${fieldName} to: ${mapping.value}`)
              break
            }
          } catch (e) {
            // Field doesn't exist or isn't a checkbox, try next name
          }
        }
      })

      // Handle checkboxes for Submittal Type
      const submittalCheckboxes = [
        { names: ['TDS', 'tds'], value: projectData.submittalType.tds },
        { names: ['3-Part Specs', '3PartSpecs', 'threePartSpecs'], value: projectData.submittalType.threePartSpecs },
        { names: ['Test Report ICC-ESR 5194', 'testReportIccEsr5194'], value: projectData.submittalType.testReportIccEsr5194 },
        { names: ['Test Report ICC-ESL 1645', 'testReportIccEsl1645'], value: projectData.submittalType.testReportIccEsl1645 },
        { names: ['Fire Assembly', 'fireAssembly'], value: projectData.submittalType.fireAssembly },
        { names: ['Fire Assembly 01', 'fireAssembly01'], value: projectData.submittalType.fireAssembly01 },
        { names: ['Fire Assembly 02', 'fireAssembly02'], value: projectData.submittalType.fireAssembly02 },
        { names: ['Fire Assembly 03', 'fireAssembly03'], value: projectData.submittalType.fireAssembly03 },
        { names: ['MSDS', 'msds', 'Material Safety Data Sheet'], value: projectData.submittalType.msds },
        { names: ['LEED Guide', 'leedGuide'], value: projectData.submittalType.leedGuide },
        { names: ['Installation Guide', 'installationGuide'], value: projectData.submittalType.installationGuide },
        { names: ['Warranty', 'warranty'], value: projectData.submittalType.warranty },
        { names: ['Samples', 'samples'], value: projectData.submittalType.samples },
        { names: ['Other', 'other'], value: projectData.submittalType.other },
      ]

      submittalCheckboxes.forEach(mapping => {
        for (const fieldName of mapping.names) {
          try {
            const checkbox = form.getCheckBox(fieldName)
            if (checkbox) {
              if (mapping.value) {
                checkbox.check()
              } else {
                checkbox.uncheck()
              }
              console.log(`Set checkbox ${fieldName} to: ${mapping.value}`)
              break
            }
          } catch (e) {
            // Field doesn't exist or isn't a checkbox, try next name
          }
        }
      })

      // Flatten the form to make it non-editable
      form.flatten()

    } catch (fillError) {
      console.warn('Error filling form fields:', fillError)
      console.log('Template will be used as-is without filling fields')
    }

    return pdfDoc

  } catch (error) {
    console.error('Error loading template PDF:', error)
    // Fallback: create a custom cover page
    console.log('Falling back to custom cover page')
    const pdf = await PDFDocument.create()
    await addCoverPage(pdf, projectData, selectedDocumentNames, allAvailableDocuments)
    return pdf
  }
}

async function addCoverPage(pdf: PDFDocument, projectData: ProjectData, selectedDocumentNames: string[], allAvailableDocuments: string[]) {
  const page = pdf.addPage(PageSizes.Letter);
  const { width, height } = page.getSize();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdf.embedFont(StandardFonts.HelveticaBold);

  // Colors - NexGen Brand Colors (#00A3CA)
  const nexgenBlue = rgb(0, 0.637, 0.792); // #00A3CA - NexGen brand blue
  const darkGray = rgb(0.13, 0.13, 0.13); // #212121
  const mediumGray = rgb(0.27, 0.27, 0.27); // #444445
  const lightBlue = rgb(0.9, 0.97, 0.98); // Light blue tint for form backgrounds
  const borderGray = rgb(0.7, 0.7, 0.7);

  // NEXGEN Logo Header (top left) - Embed PNG logo
  try {
    const logoUrl = 'https://raw.githubusercontent.com/karthikeyanasha24/pdf-packet-6/main/public/image.png';
    const logoResponse = await fetch(logoUrl);
    if (logoResponse.ok) {
      const logoBytes = await logoResponse.arrayBuffer();
      const logoImage = await pdf.embedPng(logoBytes);
      const logoHeight = 25; // Height in PDF units
      const logoWidth = (logoImage.width / logoImage.height) * logoHeight; // Maintain aspect ratio
      
      page.drawImage(logoImage, {
        x: 50,
        y: height - 55,
        width: logoWidth,
        height: logoHeight,
      });
    } else {
      // Fallback to text if logo can't be loaded
      page.drawText('NEXGEN', {
        x: 50,
        y: height - 50,
        size: 24,
        font: boldFont,
        color: nexgenBlue,
      });
    }
  } catch (error) {
    console.warn('Failed to load logo, using text fallback:', error);
    // Fallback to text if logo can't be loaded
    page.drawText('NEXGEN', {
      x: 50,
      y: height - 50,
      size: 24,
      font: boldFont,
      color: nexgenBlue,
    });
  }

  // Section identifier (top right) - Using brand blue
  const sectionText = 'SECTION 06 16 26';
  const sectionWidth = font.widthOfTextAtSize(sectionText, 10);
  page.drawRectangle({
    x: width - 150,
    y: height - 60,
    width: 100,
    height: 20,
    color: nexgenBlue,
  });
  page.drawText(sectionText, {
    x: width - 145,
    y: height - 54,
    size: 10,
    font: boldFont,
    color: rgb(1, 1, 1),
  });

  // Title - Dynamic based on product type
  const titleY = height - 100;
  const isStructuralFloor = projectData.productType === 'structural-floor';
  
  if (isStructuralFloor) {
    page.drawText('MAXTERRA® MgO Non-Combustible Structural', {
      x: 50,
      y: titleY,
      size: 12,
      font: font,
      color: darkGray,
    });
    page.drawText('Floor Panels Submittal Form', {
      x: 50,
      y: titleY - 15,
      size: 12,
      font: font,
      color: darkGray,
    });
  } else {
    // Underlayment
    page.drawText('MAXTERRA® MgO Non-Combustible', {
      x: 50,
      y: titleY,
      size: 12,
      font: font,
      color: darkGray,
    });
    page.drawText('Underlayment Panels Submittal Form', {
      x: 50,
      y: titleY - 15,
      size: 12,
      font: font,
      color: darkGray,
    });
  }

  // Form fields start position
  let currentY = titleY - 50;
  const labelX = 50;
  const valueX = 200;
  const fieldHeight = 25;
  const fieldWidth = width - valueX - 50;

  // Helper function to draw form field
  const drawFormField = (label: string, value: string, y: number) => {
    // Label
    page.drawText(label, {
      x: labelX,
      y: y + 8,
      size: 10,
      font: font,
      color: darkGray,
    });

    // Background box
    page.drawRectangle({
      x: valueX,
      y: y,
      width: fieldWidth,
      height: fieldHeight,
      color: lightBlue,
      borderColor: borderGray,
      borderWidth: 0.5,
    });

    // Value text
    page.drawText(value || '', {
      x: valueX + 5,
      y: y + 8,
      size: 10,
      font: font,
      color: rgb(0, 0, 0),
    });

    // Bottom border line
    page.drawLine({
      start: { x: labelX, y: y },
      end: { x: valueX + fieldWidth, y: y },
      color: borderGray,
      thickness: 0.5,
    });
  };

  // Draw form fields
  drawFormField('Submitted To', projectData.submittedTo, currentY);
  currentY -= fieldHeight;

  drawFormField('Project Name', projectData.projectName, currentY);
  currentY -= fieldHeight;

  drawFormField('Project Number', projectData.projectNumber || '', currentY);
  currentY -= fieldHeight;

  drawFormField('Prepared By', projectData.preparedBy, currentY);
  currentY -= fieldHeight;

  drawFormField('Phone/Email', `${projectData.phoneNumber} / ${projectData.emailAddress}`, currentY);
  currentY -= fieldHeight;

  drawFormField('Date', projectData.date, currentY);
  currentY -= fieldHeight + 10;

  // Status/Action section with checkboxes
  page.drawText('Status / Action', {
    x: labelX,
    y: currentY,
    size: 10,
    font: boldFont,
    color: darkGray,
  });
  currentY -= 20;

  const checkboxSize = 12;
  const checkboxSpacing = 130;
  let checkboxX = valueX;

  const drawCheckbox = (label: string, checked: boolean, x: number, y: number) => {
    // Checkbox border
    page.drawRectangle({
      x: x,
      y: y,
      width: checkboxSize,
      height: checkboxSize,
      borderColor: borderGray,
      borderWidth: 1,
    });

    // Checkbox background if checked
    if (checked) {
      page.drawRectangle({
        x: x + 2,
        y: y + 2,
        width: checkboxSize - 4,
        height: checkboxSize - 4,
        color: nexgenBlue,
      });

      // X mark
      page.drawText('X', {
        x: x + 3,
        y: y + 2,
        size: 9,
        font: boldFont,
        color: rgb(1, 1, 1),
      });
    }

    // Label
    page.drawText(label, {
      x: x + checkboxSize + 5,
      y: y + 2,
      size: 9,
      font: font,
      color: darkGray,
    });
  };

  drawCheckbox('For Review', projectData.status.forReview, checkboxX, currentY);
  drawCheckbox('For Approval', projectData.status.forApproval, checkboxX + checkboxSpacing, currentY);
  currentY -= 18;
  drawCheckbox('For Record', projectData.status.forRecord, checkboxX, currentY);
  drawCheckbox('For Information Only', projectData.status.forInformationOnly, checkboxX + checkboxSpacing, currentY);

  currentY -= 30;

  // Submittal Type section - DYNAMIC: Show ALL category documents, check only selected ones
  page.drawText('Submittal Type (check all that apply):', {
    x: labelX,
    y: currentY,
    size: 10,
    font: boldFont,
    color: darkGray,
  });
  currentY -= 20;

  // Draw ALL available documents from the category
  if (allAvailableDocuments && allAvailableDocuments.length > 0) {
    allAvailableDocuments.forEach((docName) => {
      // Check if this document is selected
      const isSelected = selectedDocumentNames?.includes(docName) || false;
      drawCheckbox(docName, isSelected, valueX, currentY);
    currentY -= 16;
  });
  } else if (selectedDocumentNames && selectedDocumentNames.length > 0) {
    // Fallback: if allAvailableDocuments not provided, show selected ones
    selectedDocumentNames.forEach((docName) => {
      drawCheckbox(docName, true, valueX, currentY);
      currentY -= 16;
    });
  } else {
    // No documents at all
    page.drawText('No documents available', {
      x: valueX,
      y: currentY,
      size: 9,
      font: font,
      color: rgb(0.5, 0.5, 0.5),
    });
    currentY -= 16;
  }

  currentY -= 10;

  // Product section
  page.drawText('Product:', {
    x: labelX,
    y: currentY,
    size: 10,
    font: boldFont,
    color: darkGray,
  });
  page.drawText(projectData.product, {
    x: valueX,
    y: currentY,
    size: 10,
    font: font,
    color: darkGray,
  });

  // Footer section
  const footerY = 120;
  page.drawText('NEXGEN® Building Products, LLC', {
    x: labelX,
    y: footerY,
    size: 9,
    font: boldFont,
    color: darkGray,
  });
  page.drawText('1504 Manhattan Ave West, #300 Brandon, FL 34205', {
    x: labelX,
    y: footerY - 12,
    size: 8,
    font: font,
    color: mediumGray,
  });
  page.drawText('(727) 634-5534', {
    x: labelX,
    y: footerY - 24,
    size: 8,
    font: font,
    color: mediumGray,
  });
  page.drawText('Technical Support: support@nexgenbp.com', {
    x: labelX,
    y: footerY - 36,
    size: 8,
    font: font,
    color: mediumGray,
  });

  // Version footer
  const versionText = 'Version 1.0 October 2025 © 2025 NEXGEN Building Products';
  const versionWidth = font.widthOfTextAtSize(versionText, 7);
  page.drawText(versionText, {
    x: width - versionWidth - 50,
    y: 50,
    size: 7,
    font: font,
    color: mediumGray,
  });
}

async function addDividerPage(pdf: PDFDocument, documentName: string, documentType: string, pageNumber: number) {
  const page = pdf.addPage(PageSizes.Letter)
  const { width, height } = page.getSize()
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const boldFont = await pdf.embedFont(StandardFonts.HelveticaBold)

  const nexgenBlue = rgb(0, 0.637, 0.792); // #00A3CA - NexGen brand blue
  const darkGray = rgb(0.08, 0.08, 0.08); // #141414 - Dark background
  const orange = rgb(0.93, 0.39, 0.15); // #EE6325 - Orange gradient start
  const white = rgb(1, 1, 1); // White text

  // Black background for entire page
  page.drawRectangle({
    x: 0,
    y: 0,
    width: width,
    height: height,
    color: rgb(0, 0, 0),
  })

  // Top dark gray header bar (height: 96.75)
  page.drawRectangle({
    x: 0,
    y: height - 96.75,
    width: width,
    height: 96.75,
    color: darkGray,
  })

  // NEXGEN Logo in top header (using blue/cyan logo on dark background)
  try {
    const logoUrl = 'https://raw.githubusercontent.com/karthikeyanasha24/pdf-packet-6/main/public/image-white.png';
    const logoResponse = await fetch(logoUrl);
    if (logoResponse.ok) {
      const logoBytes = await logoResponse.arrayBuffer();
      const logoImage = await pdf.embedPng(logoBytes);
      const logoHeight = 30;
      const logoWidth = (logoImage.width / logoImage.height) * logoHeight;
      
      page.drawImage(logoImage, {
        x: 15,
        y: height - 70,
        width: logoWidth,
        height: logoHeight,
      });
    } else {
      // Fallback text
      page.drawText('NEXGEN', {
        x: 15,
        y: height - 55,
        size: 24,
        font: boldFont,
        color: nexgenBlue,
      });
    }
  } catch (error) {
    // Fallback text
    page.drawText('NEXGEN', {
      x: 15,
      y: height - 55,
      size: 24,
      font: boldFont,
      color: nexgenBlue,
    });
  }

  page.drawText('Package Section Divider', {
    x: 15,
    y: height - 82,
    size: 9,
    font: font,
    color: rgb(0.5, 0.5, 0.5),
  })

  // Orange gradient bar (height: 9) - simulating gradient with solid orange
  page.drawRectangle({
    x: 0,
    y: height - 105.75,
    width: width,
    height: 9,
    color: orange,
  })

  // White content area
  page.drawRectangle({
    x: 0,
    y: 0,
    width: width,
    height: height - 105.75,
    color: white,
  })

  // "Section Divider" text (top: 134px from top, left: 74px based on your design)
  const contentStartY = height - 180;
  page.drawText('Section Divider', {
    x: 74,
    y: contentStartY,
    size: 32,
    font: font,
    color: rgb(0, 0, 0),
  })

  // Document name (LEED Credit Guide / Technical Data Sheet style)
  page.drawText(documentName, {
    x: 74,
    y: contentStartY - 50,
    size: 40,
    font: boldFont,
    color: rgb(0, 0, 0),
  })

  // Page number at bottom
  page.drawText(`Page ${pageNumber}`, {
    x: 42,
    y: 60,
    size: 10,
    font: font,
    color: rgb(0.4, 0.4, 0.4),
  })

  // Footer with copyright (matching design)
  const footerText = '© 2025 NEXGEN Building Products';
  const footerWidth = font.widthOfTextAtSize(footerText, 9);
  page.drawText(footerText, {
    x: width - footerWidth - 42,
    y: 40,
    size: 9,
    font: font,
    color: white,
  })

  // Blue footer bar at bottom
  page.drawRectangle({
    x: 0,
    y: 0,
    width: width,
    height: 30,
    color: nexgenBlue,
  })

  page.drawText(footerText, {
    x: width / 2 - footerWidth / 2,
    y: 12,
    size: 9,
    font: font,
    color: white,
  })
}

async function addErrorPage(pdf: PDFDocument, documentName: string, errorMessage: string) {
  const page = pdf.addPage(PageSizes.Letter)
  const { width, height } = page.getSize()
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const boldFont = await pdf.embedFont(StandardFonts.HelveticaBold)

  // Error header
  page.drawText('DOCUMENT ERROR', {
    x: 50,
    y: height - 100,
    size: 16,
    font: boldFont,
    color: rgb(0.8, 0.2, 0.2),
  })

  // Document name
  page.drawText(documentName, {
    x: 50,
    y: height - 150,
    size: 14,
    font: boldFont,
    color: rgb(0, 0, 0),
  })

  // Error message
  page.drawText(`Error: ${errorMessage}`, {
    x: 50,
    y: height - 180,
    size: 12,
    font: font,
    color: rgb(0.6, 0.2, 0.2),
  })

  // Instructions
  page.drawText('Please contact support if this error persists.', {
    x: 50,
    y: height - 220,
    size: 10,
    font: font,
    color: rgb(0.4, 0.4, 0.4),
  })
}

async function addPageNumbers(pdf: PDFDocument) {
  const pages = pdf.getPages()
  const font = await pdf.embedFont(StandardFonts.Helvetica)

  pages.forEach((page, index) => {
    const { width } = page.getSize()
    const pageNumber = index + 1

    page.drawText(`${pageNumber}`, {
      x: width - 50,
      y: 30,
      size: 10,
      font: font,
      color: rgb(0.4, 0.4, 0.4),
    })
  })
}

async function addProductInfoPage(pdf: PDFDocument, projectData: ProjectData) {
  const page = pdf.addPage(PageSizes.Letter)
  const { width, height } = page.getSize()
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const boldFont = await pdf.embedFont(StandardFonts.HelveticaBold)

  const isStructuralFloor = projectData.productType === 'structural-floor'
  
  const margin = 50
  const contentWidth = width - (margin * 2)
  let currentY = height - 50
  const lineHeight = 12
  const sectionSpacing = 18
  const paragraphSpacing = 10

  // Helper function to draw text with word wrap
  const drawWrappedText = (text: string, x: number, y: number, maxWidth: number, fontSize: number, fontType: any): number => {
    const words = text.split(' ')
    let line = ''
    let yPos = y

    for (const word of words) {
      const testLine = line + word + ' '
      const testWidth = fontType.widthOfTextAtSize(testLine, fontSize)
      
      if (testWidth > maxWidth && line !== '') {
        page.drawText(line.trim(), { x, y: yPos, size: fontSize, font: fontType, color: rgb(0, 0, 0) })
        line = word + ' '
        yPos -= lineHeight
      } else {
        line = testLine
      }
    }
    
    if (line.trim() !== '') {
      page.drawText(line.trim(), { x, y: yPos, size: fontSize, font: fontType, color: rgb(0, 0, 0) })
      yPos -= lineHeight
    }
    
    return yPos
  }

  // Draw section heading
  const drawSectionHeading = (heading: string, y: number): number => {
    page.drawText(heading, { x: margin, y, size: 11, font: boldFont, color: rgb(0, 0, 0) })
    return y - sectionSpacing
  }

  // STRUCTURAL FLOOR CONTENT
  if (isStructuralFloor) {
    // Title
    currentY = drawSectionHeading('What Are MAXTERRA® MgO Non-Combustible Structural Floor Panels', currentY)
    currentY = drawWrappedText('MAXTERRA® MgO Non-Combustible Structural Floor Panels are high-performance subfloor panels with tongue and groove edges engineered to deliver fire resistance, acoustical performance, structural performance, and long-term durability in a single product.', margin, currentY, contentWidth, 9, font)
    currentY -= paragraphSpacing

    // Applications
    currentY = drawSectionHeading('Applications', currentY)
    currentY = drawWrappedText('MAXTERRA® MgO Non-Combustible Structural Floor Panels are engineered and tested for use on wood and cold-formed steel framing across a wide range of structural subfloor applications, delivering superior structural performance, fire resistance, acoustic control, and long-term durability. Designed to replace traditional plywood, OSB, wet-laid gypsum underlayment, or concrete deck systems, MAXTERRA® MgO Non-Combustible Structural Floor Panels provide a stronger, more dimensionally stable platform that meets the demands of multifamily, hospitality, modular, and other high-performance construction projects. MAXTERRA® MgO Non-Combustible Structural Floor Panels are recognized by the International Code Council Evaluation Service (ICC-ES) under Evaluation Report ESR-5194, Listing Report ESL-1645, and Underwriters Laboratories (UL) under Report R41539 confirming compliance for use in fire-rated and sound-rated floor assemblies across Types I–V construction.', margin, currentY, contentWidth, 9, font)
    currentY -= paragraphSpacing

    // Skip-the-Gyp
    currentY = drawSectionHeading('Skip-the-Gyp™ & Ditch-the-Deck™ Advantage', currentY)
    currentY = drawWrappedText('MAXTERRA® MgO Non-Combustible Structural Floor Panels are engineered as a single-layer system that delivers a faster, cleaner, and more efficient installation process while achieving code-required STC/IIC sound when installed as part of tested floor/ceiling assemblies. Unlike gypsum cement underlayment or costly and complex pan-and-pour systems, MAXTERRA® panels eliminate the need for a separate wet-floor trades, door header or base plate modifications, added project oversight, and lengthy cure times that can delay or halt construction schedules. The result is a streamlined, single-trade solution that ensures reliable fire, sound, and structural performance across all types of high-demand projects.', margin, currentY, contentWidth, 9, font)
    currentY -= paragraphSpacing

    // Continue on second page if needed
    if (currentY < 200) {
      const page2 = pdf.addPage(PageSizes.Letter)
      currentY = height - 50
    }

    // Specifications in two columns
    currentY -= 10
    const col1X = margin
    const col2X = width / 2 + 20
    const colWidth = (width / 2) - margin - 30

    // Left column specifications
    let leftY = currentY
    leftY = drawSectionHeading('Available Thicknesses', leftY)
    page.drawText('3/4-inch (20 mm)', { x: col1X, y: leftY, size: 9, font, color: rgb(0, 0, 0) })
    leftY -= sectionSpacing

    leftY = drawSectionHeading('Available Lengths', leftY)
    page.drawText('8 feet; 10 feet', { x: col1X, y: leftY, size: 9, font, color: rgb(0, 0, 0) })
    leftY -= sectionSpacing

    leftY = drawSectionHeading('Product Weight', leftY)
    page.drawText('4.92 lb/sqft', { x: col1X, y: leftY, size: 9, font, color: rgb(0, 0, 0) })
    leftY -= sectionSpacing

    leftY = drawSectionHeading('Edge Profile', leftY)
    page.drawText('Tongue & Groove (TG), & Square Edge (SE)*', { x: col1X, y: leftY, size: 9, font, color: rgb(0, 0, 0) })
    leftY -= sectionSpacing

    leftY = drawSectionHeading('Mold / Mildew Resistance (ASTM G21)', leftY)
    page.drawText('"0 Growth Observed"', { x: col1X, y: leftY, size: 9, font, color: rgb(0, 0, 0) })
    leftY -= sectionSpacing

    // Right column specifications
    let rightY = currentY
    rightY = drawSectionHeading('Surface Burning Characteristics', rightY)
    page.drawText('(ASTM E84 / UL 723)', { x: col2X, y: rightY, size: 8, font, color: rgb(0.3, 0.3, 0.3) })
    rightY -= 12
    page.drawText('Flame Spread Index: 0', { x: col2X, y: rightY, size: 9, font, color: rgb(0, 0, 0) })
    rightY -= 12
    page.drawText('Smoke Developed Index: 0', { x: col2X, y: rightY, size: 9, font, color: rgb(0, 0, 0) })
    rightY -= sectionSpacing

    rightY = drawSectionHeading('STC / IIC Acoustic Performance', rightY)
    page.drawText('(ASTM E90 and ASTM E492)', { x: col2X, y: rightY, size: 8, font, color: rgb(0.3, 0.3, 0.3) })
    rightY -= 12
    page.drawText('See ESL-1645', { x: col2X, y: rightY, size: 9, font, color: rgb(0, 0, 0) })
    rightY -= sectionSpacing

    rightY = drawSectionHeading('Allowable Exposure', rightY)
    page.drawText('Up to 200 days', { x: col2X, y: rightY, size: 9, font, color: rgb(0, 0, 0) })
    rightY -= sectionSpacing

    // Bottom section - Remarks and Approvals
    currentY = Math.min(leftY, rightY) - 20
    
    currentY = drawSectionHeading('Remarks', currentY)
    page.drawRectangle({ x: margin, y: currentY - 40, width: contentWidth, height: 35, borderColor: rgb(0, 0, 0), borderWidth: 1 })
    currentY -= 50

    currentY = drawSectionHeading('Approvals', currentY)
    currentY -= 5
    page.drawText('Architect/Engineer Review', { x: margin, y: currentY, size: 9, font: boldFont, color: rgb(0, 0, 0) })
    currentY -= 15
    
    // Approval checkboxes
    const checkboxSize = 10
    const checkboxY = currentY
    page.drawRectangle({ x: margin, y: checkboxY, width: checkboxSize, height: checkboxSize, borderColor: rgb(0, 0, 0), borderWidth: 1 })
    page.drawText('Approved', { x: margin + 15, y: checkboxY + 2, size: 8, font, color: rgb(0, 0, 0) })
    
    page.drawRectangle({ x: margin + 80, y: checkboxY, width: checkboxSize, height: checkboxSize, borderColor: rgb(0, 0, 0), borderWidth: 1 })
    page.drawText('Revise & Resubmit', { x: margin + 95, y: checkboxY + 2, size: 8, font, color: rgb(0, 0, 0) })
    
    page.drawRectangle({ x: margin + 200, y: checkboxY, width: checkboxSize, height: checkboxSize, borderColor: rgb(0, 0, 0), borderWidth: 1 })
    page.drawText('Approval as Noted', { x: margin + 215, y: checkboxY + 2, size: 8, font, color: rgb(0, 0, 0) })
    
    page.drawRectangle({ x: margin + 330, y: checkboxY, width: checkboxSize, height: checkboxSize, borderColor: rgb(0, 0, 0), borderWidth: 1 })
    page.drawText('Rejected', { x: margin + 345, y: checkboxY + 2, size: 8, font, color: rgb(0, 0, 0) })
    
    currentY -= 25
    page.drawText('Signature ________________________', { x: margin, y: currentY, size: 9, font, color: rgb(0, 0, 0) })
    page.drawText('Date ____________', { x: margin + 250, y: currentY, size: 9, font, color: rgb(0, 0, 0) })
  } 
  // UNDERLAYMENT CONTENT
  else {
    // Title
    currentY = drawSectionHeading('What Is MAXTERRA® MgO Fire- And Water-Resistant Underlayment', currentY)
    currentY = drawWrappedText('MAXTERRA® MgO Fire- And Water-Resistant Underlayment Panels are engineered to deliver superior fire resistance, acoustic performance, and dimensional stability for today\'s demanding job sites. Manufactured from magnesium oxide (MgO) with reinforcing glass fiber mesh, MAXTERRA® panels provide a high-density, fire-resistant solution. They are designed for use as flooring underlayment over wood structural panels, serving as a durable replacement for other underlayment products such as wet-laid gypsum in both sound- and fire-rated assemblies.', margin, currentY, contentWidth, 9, font)
    currentY -= paragraphSpacing

    // Applications
    currentY = drawSectionHeading('Applications', currentY)
    currentY = drawWrappedText('MAXTERRA® MgO Fire- And Water-Resistant Underlayment Panels are engineered and tested for use across a wide range of flooring underlayment applications, delivering proven performance in sound control, fire resistance, and structural durability. MAXTERRA® provides a more durable and dimensionally stable solution and is ideally suited for multifamily, hospitality, modular, and other high-performance construction projects. MAXTERRA® MgO Fire- And Water-Resistant Underlayment Panels are recognized by the International Code Council Evaluation Service (ICC-ES) under Evaluation Report ESR-5192 and Listing Report ESL-1645.', margin, currentY, contentWidth, 9, font)
    currentY -= paragraphSpacing

    // Skip-the-Gyp
    currentY = drawSectionHeading('Skip-the-Gyp™ Advantage', currentY)
    currentY = drawWrappedText('MAXTERRA® MgO Fire- And Water-Resistant Underlayment Panels are engineered to achieve code-required STC/IIC sound ratings without the need for gypsum cement underlayment or sound mats, when installed as part of tested floor/ceiling assemblies. Unlike gypsum cement, MAXTERRA® MgO Fire- And Water-Resistant Underlayment Panels eliminate the need for a separate gypsum underlayment trade, additional sill plates, modifications to door headers, and additional project oversight – all while avoiding long cure times, cleanup, and callbacks that can delay or halt construction schedules. The result is a faster, cleaner, and more efficient installation process with reliable performance.', margin, currentY, contentWidth, 9, font)
    currentY -= paragraphSpacing

    // Continue on second page if needed
    if (currentY < 200) {
      const page2 = pdf.addPage(PageSizes.Letter)
      currentY = height - 50
    }

    // Specifications in two columns
    currentY -= 10
    const col1X = margin
    const col2X = width / 2 + 20

    // Left column
    let leftY = currentY
    leftY = drawSectionHeading('Available Thicknesses', leftY)
    page.drawText('1/2" (12 mm), & 5/8" (16 mm)', { x: col1X, y: leftY, size: 9, font, color: rgb(0, 0, 0) })
    leftY -= sectionSpacing

    leftY = drawSectionHeading('Available Dimensions', leftY)
    page.drawText('4 feet x 8 feet', { x: col1X, y: leftY, size: 9, font, color: rgb(0, 0, 0) })
    leftY -= sectionSpacing

    leftY = drawSectionHeading('Product Weight', leftY)
    page.drawText('1/2" (12 mm): 2.22 lb/sqft', { x: col1X, y: leftY, size: 9, font, color: rgb(0, 0, 0) })
    leftY -= 12
    page.drawText('5/8" (16 mm): 2.95 lb/sqft', { x: col1X, y: leftY, size: 9, font, color: rgb(0, 0, 0) })
    leftY -= sectionSpacing

    leftY = drawSectionHeading('Edge Profile', leftY)
    page.drawText('Square Edge (SE)', { x: col1X, y: leftY, size: 9, font, color: rgb(0, 0, 0) })
    leftY -= sectionSpacing

    leftY = drawSectionHeading('Construction Types', leftY)
    page.drawText('Types III, IV-C, IV-HT, and V', { x: col1X, y: leftY, size: 9, font, color: rgb(0, 0, 0) })
    leftY -= sectionSpacing

    // Right column
    let rightY = currentY
    rightY = drawSectionHeading('Surface Burning Characteristics', rightY)
    page.drawText('(ASTM E84 / UL 723)', { x: col2X, y: rightY, size: 8, font, color: rgb(0.3, 0.3, 0.3) })
    rightY -= 12
    page.drawText('Flame Spread Index: 0', { x: col2X, y: rightY, size: 9, font, color: rgb(0, 0, 0) })
    rightY -= 12
    page.drawText('Smoke Developed Index: 0', { x: col2X, y: rightY, size: 9, font, color: rgb(0, 0, 0) })
    rightY -= sectionSpacing

    rightY = drawSectionHeading('STC / IIC Acoustic Performance', rightY)
    page.drawText('(ASTM E90 and ASTM E492)', { x: col2X, y: rightY, size: 8, font, color: rgb(0.3, 0.3, 0.3) })
    rightY -= 12
    page.drawText('See ESL-1645', { x: col2X, y: rightY, size: 9, font, color: rgb(0, 0, 0) })
    rightY -= sectionSpacing

    rightY = drawSectionHeading('Allowable Exposure', rightY)
    page.drawText('Up to 200 days', { x: col2X, y: rightY, size: 9, font, color: rgb(0, 0, 0) })
    rightY -= sectionSpacing

    // Bottom section
    currentY = Math.min(leftY, rightY) - 20
    
    currentY = drawSectionHeading('Remarks', currentY)
    page.drawRectangle({ x: margin, y: currentY - 40, width: contentWidth, height: 35, borderColor: rgb(0, 0, 0), borderWidth: 1 })
    currentY -= 50

    currentY = drawSectionHeading('Approvals', currentY)
    currentY -= 5
    page.drawText('Architect/Engineer Review', { x: margin, y: currentY, size: 9, font: boldFont, color: rgb(0, 0, 0) })
    currentY -= 15
    
    // Approval checkboxes
    const checkboxSize = 10
    const checkboxY = currentY
    page.drawRectangle({ x: margin, y: checkboxY, width: checkboxSize, height: checkboxSize, borderColor: rgb(0, 0, 0), borderWidth: 1 })
    page.drawText('Approved', { x: margin + 15, y: checkboxY + 2, size: 8, font, color: rgb(0, 0, 0) })
    
    page.drawRectangle({ x: margin + 80, y: checkboxY, width: checkboxSize, height: checkboxSize, borderColor: rgb(0, 0, 0), borderWidth: 1 })
    page.drawText('Revise & Resubmit', { x: margin + 95, y: checkboxY + 2, size: 8, font, color: rgb(0, 0, 0) })
    
    page.drawRectangle({ x: margin + 200, y: checkboxY, width: checkboxSize, height: checkboxSize, borderColor: rgb(0, 0, 0), borderWidth: 1 })
    page.drawText('Approval as Noted', { x: margin + 215, y: checkboxY + 2, size: 8, font, color: rgb(0, 0, 0) })
    
    page.drawRectangle({ x: margin + 330, y: checkboxY, width: checkboxSize, height: checkboxSize, borderColor: rgb(0, 0, 0), borderWidth: 1 })
    page.drawText('Rejected', { x: margin + 345, y: checkboxY + 2, size: 8, font, color: rgb(0, 0, 0) })
    
    currentY -= 25
    page.drawText('Signature ________________________', { x: margin, y: currentY, size: 9, font, color: rgb(0, 0, 0) })
    page.drawText('Date ____________', { x: margin + 250, y: currentY, size: 9, font, color: rgb(0, 0, 0) })
  }
}
