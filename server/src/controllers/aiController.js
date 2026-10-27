const fs = require('fs');
const path = require('path');
const { successResponse, errorResponse } = require('../utils/apiResponse');

/**
 * Extract text from PDF using pdf-parse
 */
const extractTextFromPDF = async (filePath) => {
  const pdfParse = require('pdf-parse');
  const dataBuffer = fs.readFileSync(filePath);
  const data = await pdfParse(dataBuffer);
  return data.text || '';
};

/**
 * Extract text from image using Tesseract OCR
 */
const extractTextFromImage = async (filePath) => {
  const Tesseract = require('tesseract.js');
  const { data: { text } } = await Tesseract.recognize(filePath, 'eng', {
    logger: () => {}, // suppress logs
  });
  return text || '';
};

/**
 * Call AI provider for structured extraction
 */
const callAIProvider = async (extractedText) => {
  const provider = (process.env.AI_PROVIDER || 'gemini').toLowerCase();
  const apiKey = process.env.AI_API_KEY;
  const model = process.env.AI_MODEL;

  if (!apiKey || apiKey.startsWith('your_') || apiKey.startsWith('REPLACE_') || apiKey === 'your_gemini_api_key_here' || apiKey.length < 10) {
    throw new Error(
      'AI_API_KEY is not configured. Open server/.env and replace the placeholder with a real API key. ' +
      'Get a free Groq key at: https://console.groq.com/keys'
    );
  }

  const systemPrompt = `You are an invoice data extraction assistant. Extract structured invoice data from the provided text and return ONLY a valid JSON object with no markdown, no explanation, and no extra text.

Return exactly this JSON structure (use null for missing fields):
{
  "invoiceNumber": "string or null",
  "invoiceDate": "YYYY-MM-DD or null",
  "dueDate": "YYYY-MM-DD or null",
  "supplierName": "string or null",
  "supplierGstin": "string or null",
  "supplierAddress": "string or null",
  "customerName": "string or null",
  "customerGstin": "string or null",
  "customerAddress": "string or null",
  "lineItems": [
    {
      "description": "string",
      "quantity": number,
      "unitPrice": number,
      "taxRate": number,
      "hsnCode": "string or null"
    }
  ],
  "subtotal": number or null,
  "discountAmount": number or null,
  "taxTotal": number or null,
  "grandTotal": number or null,
  "currency": "INR",
  "notes": "string or null",
  "confidence": number between 0 and 1,
  "missingFields": ["list of field names that could not be extracted"],
  "warnings": ["list of any concerns about the data quality"]
}

Rules:
- All monetary values should be in the invoice's currency (do not convert)
- If a field is not present in the text, return null - do not invent values
- confidence is your overall confidence in the extraction (0.0 to 1.0)
- lineItems must be an array; return empty array [] if no items found
- Do not infer or guess tax numbers or financial totals that are not explicitly in the text`;

  const userMessage = `Extract invoice data from this text:\n\n${extractedText.substring(0, 8000)}`;

  let responseText = '';

  if (provider === 'openai') {
    const axios = require('axios');
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: model || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        temperature: 0.1,
        max_tokens: 2000,
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      }
    );
    responseText = response.data.choices[0].message.content;
  } else if (provider === 'gemini') {
    const axios = require('axios');
    const geminiModel = model || 'gemini-1.5-flash';
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${apiKey}`,
      {
        contents: [
          {
            parts: [
              {
                text: `${systemPrompt}\n\n${userMessage}`,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 2000,
        },
      },
      { timeout: 30000 }
    );
    responseText = response.data.candidates[0].content.parts[0].text;
  } else if (provider === 'groq') {
    const axios = require('axios');
    const response = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: model || 'llama3-70b-8192',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        temperature: 0.1,
        max_tokens: 2000,
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      }
    );
    responseText = response.data.choices[0].message.content;
  } else {
    throw new Error(
      `Unsupported AI provider: "${provider}". Supported providers: openai, gemini, groq`
    );
  }

  return responseText;
};

/**
 * Parse and validate the AI JSON response
 */
const parseAIResponse = (rawText) => {
  // Strip markdown code fences if present
  let cleaned = rawText.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (e) {
    // Try to extract JSON from response
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      parsed = JSON.parse(jsonMatch[0]);
    } else {
      throw new Error('AI returned non-JSON response. The document may not contain readable invoice data.');
    }
  }

  // Validate structure
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('AI returned invalid response structure');
  }

  // Ensure lineItems is array
  if (!Array.isArray(parsed.lineItems)) {
    parsed.lineItems = [];
  }

  // Sanitize: ensure no injected keys that could override system behavior
  const allowed = [
    'invoiceNumber', 'invoiceDate', 'dueDate', 'supplierName', 'supplierGstin',
    'supplierAddress', 'customerName', 'customerGstin', 'customerAddress',
    'lineItems', 'subtotal', 'discountAmount', 'taxTotal', 'grandTotal',
    'currency', 'notes', 'confidence', 'missingFields', 'warnings',
  ];

  const sanitized = {};
  for (const key of allowed) {
    if (parsed[key] !== undefined) sanitized[key] = parsed[key];
  }

  // Sanitize line items
  sanitized.lineItems = (parsed.lineItems || []).map((item) => ({
    description: typeof item.description === 'string' ? item.description.substring(0, 500) : '',
    quantity: typeof item.quantity === 'number' ? item.quantity : 1,
    unitPrice: typeof item.unitPrice === 'number' ? item.unitPrice : 0,
    taxRate: typeof item.taxRate === 'number' ? item.taxRate : 0,
    hsnCode: typeof item.hsnCode === 'string' ? item.hsnCode : null,
  }));

  return sanitized;
};

// POST /api/v1/ai/extract-invoice
const extractInvoice = async (req, res, next) => {
  let filePath = null;
  try {
    if (!req.file) {
      return errorResponse(res, 'No file uploaded. Please upload a PDF, JPG, JPEG, or PNG.', 400);
    }

    filePath = req.file.path;
    const ext = path.extname(req.file.originalname).toLowerCase();
    const mimeType = req.file.mimetype.toLowerCase();

    // Double-check file content is readable
    if (!fs.existsSync(filePath)) {
      return errorResponse(res, 'Uploaded file not found on server.', 500);
    }

    const fileSizeBytes = fs.statSync(filePath).size;
    if (fileSizeBytes === 0) {
      return errorResponse(res, 'Uploaded file is empty.', 400);
    }

    let extractedText = '';
    let extractionMethod = '';

    try {
      if (ext === '.pdf' || mimeType === 'application/pdf') {
        extractedText = await extractTextFromPDF(filePath);
        extractionMethod = 'pdf-parse';

        // If PDF has no extractable text, try OCR
        if (!extractedText || extractedText.trim().length < 50) {
          console.log('PDF has minimal text, attempting OCR fallback...');
          extractedText = await extractTextFromImage(filePath);
          extractionMethod = 'ocr-fallback';
        }
      } else if (['.jpg', '.jpeg', '.png'].includes(ext)) {
        extractedText = await extractTextFromImage(filePath);
        extractionMethod = 'tesseract-ocr';
      }
    } catch (extractionError) {
      console.error('Text extraction error:', extractionError.message);
      return errorResponse(
        res,
        `Could not extract text from the uploaded file: ${extractionError.message}. Please try manual entry.`,
        422
      );
    }

    if (!extractedText || extractedText.trim().length < 10) {
      return errorResponse(
        res,
        'Could not extract readable text from the document. The file may be too low quality or contain only images without text. Please use manual invoice entry.',
        422
      );
    }

    // Call AI
    let rawAIResponse;
    try {
      rawAIResponse = await callAIProvider(extractedText);
    } catch (aiError) {
      console.error('AI provider error:', aiError.message);

      // Handle specific error types
      if (aiError.response?.status === 429) {
        return errorResponse(res, 'AI service rate limit exceeded. Please try again in a moment.', 429);
      }
      if (aiError.response?.status === 401 || aiError.response?.status === 403) {
        return errorResponse(
          res,
          'AI API key is invalid or unauthorized. Please check your AI_API_KEY configuration.',
          503
        );
      }
      if (aiError.code === 'ECONNABORTED' || aiError.code === 'ETIMEDOUT') {
        return errorResponse(res, 'AI service timed out. Please try again or use manual entry.', 504);
      }

      const message = aiError.message || 'AI service unavailable.';
      return errorResponse(
        res,
        `AI extraction failed: ${message}. You can use manual invoice entry as a fallback.`,
        503
      );
    }

    // Parse AI response
    let extractedData;
    try {
      extractedData = parseAIResponse(rawAIResponse);
    } catch (parseError) {
      console.error('AI response parse error:', parseError.message);
      return errorResponse(
        res,
        `Could not parse AI response: ${parseError.message}. Please use manual entry.`,
        422
      );
    }

    // Server-side recalculation and discrepancy check
    const warnings = extractedData.warnings || [];
    if (extractedData.lineItems && extractedData.lineItems.length > 0) {
      const calculatedSubtotal = extractedData.lineItems.reduce((sum, item) => {
        return sum + (item.quantity || 0) * (item.unitPrice || 0);
      }, 0);
      const calculatedTax = extractedData.lineItems.reduce((sum, item) => {
        const itemAmount = (item.quantity || 0) * (item.unitPrice || 0);
        return sum + itemAmount * ((item.taxRate || 0) / 100);
      }, 0);
      const calculatedTotal = calculatedSubtotal + calculatedTax;

      if (extractedData.grandTotal && Math.abs(calculatedTotal - extractedData.grandTotal) > 1) {
        warnings.push(
          `Calculated total (${calculatedTotal.toFixed(2)}) differs from extracted total (${extractedData.grandTotal}). Please verify line items and totals.`
        );
      }
    }

    return successResponse(res, {
      extractedData: { ...extractedData, warnings },
      extractionMethod,
      rawTextLength: extractedText.length,
      fileName: req.file.originalname,
      savedFileName: path.basename(filePath), // saved file name for later retrieval
    });
  } catch (error) {
    next(error);
  } finally {
    // Do NOT delete the file — keep it as proof/record
    // Files are stored in uploads/ folder permanently
    filePath = null; // prevent deletion in finally
  }
};

// POST /api/v1/ai/financial-insights
const getFinancialInsights = async (req, res, next) => {
  try {
    const Invoice = require('../models/Invoice');
    const Payment = require('../models/Payment');
    const userId = req.user._id;

    // Gather actual data from DB (never let AI invent these)
    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const sixtyDaysAgo = new Date(now);
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    const [currentMonthStats] = await Invoice.aggregate([
      { $match: { user: userId, issueDate: { $gte: thirtyDaysAgo } } },
      {
        $group: {
          _id: null,
          totalInvoiced: { $sum: '$grandTotal' },
          totalPaid: { $sum: '$paidAmount' },
          count: { $sum: 1 },
          overdueCount: {
            $sum: {
              $cond: [
                { $and: [{ $lt: ['$dueDate', now] }, { $lt: ['$paidAmount', '$grandTotal'] }] },
                1, 0,
              ],
            },
          },
        },
      },
    ]);

    const [prevMonthStats] = await Invoice.aggregate([
      { $match: { user: userId, issueDate: { $gte: sixtyDaysAgo, $lt: thirtyDaysAgo } } },
      {
        $group: {
          _id: null,
          totalInvoiced: { $sum: '$grandTotal' },
          totalPaid: { $sum: '$paidAmount' },
          count: { $sum: 1 },
        },
      },
    ]);

    const [overallStats] = await Invoice.aggregate([
      { $match: { user: userId } },
      {
        $group: {
          _id: null,
          totalInvoiced: { $sum: '$grandTotal' },
          totalPaid: { $sum: '$paidAmount' },
          totalCount: { $sum: 1 },
          avgInvoiceValue: { $avg: '$grandTotal' },
        },
      },
    ]);

    const overdueInvoices = await Invoice.find({
      user: userId,
      dueDate: { $lt: now },
      $expr: { $lt: ['$paidAmount', '$grandTotal'] },
      status: { $nin: ['paid', 'cancelled', 'draft'] },
    })
      .sort({ dueDate: 1 })
      .limit(10)
      .select('invoiceNumber dueDate grandTotal paidAmount customerSnapshot')
      .lean();

    const apiKey = process.env.AI_API_KEY;
    if (!apiKey || apiKey.startsWith('your_') || apiKey.length < 10) {
      // Return rule-based insights without AI
      const insights = generateRuleBasedInsights(
        currentMonthStats,
        prevMonthStats,
        overallStats,
        overdueInvoices
      );
      return successResponse(res, { insights, generatedBy: 'rule-based' });
    }

    // Prepare context for AI (only aggregated data, no PII)
    const context = {
      currentMonth: {
        totalInvoiced: ((currentMonthStats?.totalInvoiced || 0) / 100).toFixed(2),
        totalPaid: ((currentMonthStats?.totalPaid || 0) / 100).toFixed(2),
        invoiceCount: currentMonthStats?.count || 0,
        overdueCount: currentMonthStats?.overdueCount || 0,
      },
      previousMonth: {
        totalInvoiced: ((prevMonthStats?.totalInvoiced || 0) / 100).toFixed(2),
        totalPaid: ((prevMonthStats?.totalPaid || 0) / 100).toFixed(2),
        invoiceCount: prevMonthStats?.count || 0,
      },
      overall: {
        totalInvoiced: ((overallStats?.totalInvoiced || 0) / 100).toFixed(2),
        totalPaid: ((overallStats?.totalPaid || 0) / 100).toFixed(2),
        totalCount: overallStats?.totalCount || 0,
        avgInvoiceValue: ((overallStats?.avgInvoiceValue || 0) / 100).toFixed(2),
        collectionRate: overallStats?.totalInvoiced > 0
          ? ((overallStats.totalPaid / overallStats.totalInvoiced) * 100).toFixed(1)
          : '0',
      },
      overdueCount: overdueInvoices.length,
      totalOverdueAmount: (
        overdueInvoices.reduce((s, inv) => s + (inv.grandTotal - inv.paidAmount), 0) / 100
      ).toFixed(2),
    };

    const prompt = `You are a financial advisor assistant for a small business. Based on these financial metrics, provide 3-5 concise, actionable insights. Be specific and practical. Do NOT invent numbers - use only the data provided.

Financial Data (amounts in INR):
${JSON.stringify(context, null, 2)}

Provide insights as a JSON array:
[
  {
    "type": "success|warning|info|alert",
    "title": "Short title",
    "message": "1-2 sentence actionable insight",
    "metric": "relevant metric if applicable"
  }
]

Focus on: collection rate, overdue invoices, month-over-month trends, cash flow observations.
Do NOT make up predictions. Only observe the data provided.`;

    let aiInsights = null;
    try {
      const rawResponse = await callAIProvider(prompt);
      let cleaned = rawResponse.trim();
      if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
      }
      const jsonMatch = cleaned.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        aiInsights = JSON.parse(jsonMatch[0]);
      }
    } catch (aiError) {
      console.warn('AI insights failed, using rule-based:', aiError.message);
    }

    const insights = aiInsights || generateRuleBasedInsights(
      currentMonthStats, prevMonthStats, overallStats, overdueInvoices
    );

    return successResponse(res, {
      insights,
      context,
      generatedBy: aiInsights ? 'ai' : 'rule-based',
    });
  } catch (error) {
    next(error);
  }
};

function generateRuleBasedInsights(current, prev, overall, overdueInvoices) {
  const insights = [];

  const totalInvoiced = overall?.totalInvoiced || 0;
  const totalPaid = overall?.totalPaid || 0;
  const collectionRate = totalInvoiced > 0 ? (totalPaid / totalInvoiced) * 100 : 0;

  if (collectionRate >= 90) {
    insights.push({
      type: 'success',
      title: 'Strong Collection Rate',
      message: `Your collection rate is ${collectionRate.toFixed(1)}%, which is excellent. Keep following up promptly on outstanding invoices.`,
      metric: `${collectionRate.toFixed(1)}% collected`,
    });
  } else if (collectionRate < 60) {
    insights.push({
      type: 'alert',
      title: 'Low Collection Rate',
      message: `Only ${collectionRate.toFixed(1)}% of invoiced amounts have been collected. Consider sending payment reminders and reviewing credit terms.`,
      metric: `${collectionRate.toFixed(1)}% collected`,
    });
  }

  if (overdueInvoices.length > 0) {
    const overdueTotal = overdueInvoices.reduce((s, inv) => s + (inv.grandTotal - inv.paidAmount), 0);
    insights.push({
      type: 'warning',
      title: 'Overdue Invoices Need Attention',
      message: `You have ${overdueInvoices.length} overdue invoice(s) totaling ₹${(overdueTotal / 100).toFixed(2)}. Send reminders to improve cash flow.`,
      metric: `${overdueInvoices.length} overdue`,
    });
  }

  const currentInvoiced = current?.totalInvoiced || 0;
  const prevInvoiced = prev?.totalInvoiced || 0;
  if (prevInvoiced > 0 && currentInvoiced !== prevInvoiced) {
    const change = ((currentInvoiced - prevInvoiced) / prevInvoiced) * 100;
    insights.push({
      type: change >= 0 ? 'success' : 'info',
      title: change >= 0 ? 'Revenue Growing' : 'Revenue Declined',
      message: `This month's invoiced amount ${change >= 0 ? 'increased' : 'decreased'} by ${Math.abs(change).toFixed(1)}% compared to last month.`,
      metric: `${change >= 0 ? '+' : ''}${change.toFixed(1)}% vs last month`,
    });
  }

  if (overall?.totalCount === 0) {
    insights.push({
      type: 'info',
      title: 'Get Started',
      message: 'Create your first invoice to start tracking your business financials.',
      metric: '0 invoices',
    });
  }

  return insights;
}

// POST /api/v1/ai/payment-reminders
const generatePaymentReminder = async (req, res, next) => {
  try {
    const { invoiceId } = req.body;
    const Invoice = require('../models/Invoice');

    const invoice = await Invoice.findOne({
      _id: invoiceId,
      user: req.user._id,
    })
      .populate('customer', 'name email')
      .lean();

    if (!invoice) {
      return errorResponse(res, 'Invoice not found.', 404);
    }

    const outstanding = (invoice.grandTotal - invoice.paidAmount) / 100;
    const daysPastDue = invoice.dueDate < new Date()
      ? Math.floor((new Date() - invoice.dueDate) / (1000 * 60 * 60 * 24))
      : 0;

    const businessName = req.user.businessName || req.user.name;
    const customerName = invoice.customerSnapshot?.name || invoice.customer?.name || 'Valued Customer';

    const draftEmail = generateEmailDraft(
      businessName,
      customerName,
      invoice.invoiceNumber,
      outstanding,
      invoice.dueDate,
      daysPastDue
    );

    return successResponse(res, {
      reminder: {
        to: invoice.customer?.email || invoice.customerSnapshot?.email || '',
        subject: `Payment Reminder - Invoice ${invoice.invoiceNumber}`,
        body: draftEmail,
        invoiceNumber: invoice.invoiceNumber,
        outstanding,
        daysPastDue,
      },
      note: 'This is a draft. Review and send manually via your email client.',
    });
  } catch (error) {
    next(error);
  }
};

function generateEmailDraft(businessName, customerName, invoiceNumber, outstanding, dueDate, daysPastDue) {
  const dueDateStr = new Date(dueDate).toLocaleDateString('en-IN');
  const isOverdue = daysPastDue > 0;

  return `Dear ${customerName},

${isOverdue
  ? `I hope this message finds you well. This is a friendly reminder that Invoice ${invoiceNumber} is now ${daysPastDue} day(s) past its due date of ${dueDateStr}.`
  : `I hope this message finds you well. This is a friendly reminder that Invoice ${invoiceNumber} is due on ${dueDateStr}.`
}

Outstanding Amount: ₹${outstanding.toFixed(2)}
Invoice Number: ${invoiceNumber}
${isOverdue ? `Due Date: ${dueDateStr} (${daysPastDue} day(s) overdue)` : `Due Date: ${dueDateStr}`}

Please arrange payment at your earliest convenience. If you have already made the payment, kindly disregard this reminder and share the payment details.

If you have any questions about this invoice, please don't hesitate to reach out.

Thank you for your continued business.

Best regards,
${businessName}`;
}

module.exports = {
  extractInvoice,
  getFinancialInsights,
  generatePaymentReminder,
};
