import express from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { logger } from '../utils/logger.js';
import db from '../config/database.js';

const router = express.Router();

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// Analyze inspection item for pass/fail
router.post('/analyze', async (req, res) => {
  try {
    const { description, photos, itemType, hqsGuidance } = req.body;

    if (!description && !photos?.length) {
      return res.status(400).json({ error: 'Description or photos required' });
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

    const prompt = `
      You are an HQS (Housing Quality Standards) inspector assistant. 
      Analyze the following inspection item and determine if it passes or fails HUD standards.
      
      Item Type: ${itemType}
      HUD Guidance: ${hqsGuidance}
      Description: ${description}
      
      Based on HUD standards (24 CFR 982.401), determine:
      1. Status: PASS, FAIL, or INCONCLUSIVE
      2. If FAIL, is this a 24-hour emergency item?
      3. Responsibility: owner or tenant
      4. Recommended comment for the inspection report
      
      Respond in JSON format:
      {
        "status": "PASS|FAIL|INCONCLUSIVE",
        "is24Hour": true|false,
        "responsibility": "owner|tenant",
        "comment": "detailed comment",
        "reasoning": "explanation of decision"
      }
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    // Parse AI response
    let aiAnalysis;
    try {
      // Extract JSON from response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        aiAnalysis = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      logger.error('Failed to parse AI response:', text);
      aiAnalysis = {
        status: 'INCONCLUSIVE',
        is24Hour: false,
        responsibility: 'owner',
        comment: 'AI analysis inconclusive',
        reasoning: text
      };
    }

    // Log AI decision for audit
    await db('audit_trails').insert({
      user_id: req.user.id,
      agency_id: req.agencyId,
      action: 'ai_analysis',
      entity_type: 'inspection_item',
      changes: {
        input: { description, itemType },
        output: aiAnalysis
      }
    });

    res.json(aiAnalysis);
  } catch (error) {
    logger.error('AI analysis error:', error);
    res.status(500).json({ error: 'AI analysis failed' });
  }
});

// Voice-command style inspection update (mirrors frontend HQS logic)
router.post('/voice-command', async (req, res) => {
  try {
    const { transcript, sections } = req.body;

    if (!transcript || !Array.isArray(sections)) {
      return res.status(400).json({ error: 'Transcript and sections are required' });
    }

    const trimmedSections = sections.map(section => ({
      id: section.id,
      title: section.title,
      items: section.items?.map(item => ({
        id: item.id,
        label: item.label,
        status: item.status
      })) || []
    }));

    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
    const prompt = `
      You are an HQS (Housing Quality Standards) Inspection assistant.
      The user is speaking an observation or providing a note.

      Current Form Structure & Status:
      ${JSON.stringify(trimmedSections).substring(0, 15000)}

      User Input: "${transcript}"

      Your Tasks:
      1. Identify the most relevant Section ID and Item ID.
      2. Determine the status: PASS, FAIL, INCONCLUSIVE, or N/A.
      3. Summarize the input into professional HQS short-form language (<= 220 characters).
      4. Determine if this is a 24-Hour Fail using HUD guidance.
      5. Determine Responsibility (owner vs tenant) when mentioned; default owner.

      Return JSON only with:
      {
        "sectionId": "string|null",
        "itemId": "string|null",
        "status": "PASS|FAIL|INCONCLUSIVE|N/A",
        "comment": "string",
        "is24Hour": true|false,
        "responsibility": "owner|tenant"
      }
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    let parsed;
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
    } catch (err) {
      logger.warn('Failed to parse voice command response:', err);
    }

    const normalized = {
      sectionId: parsed?.sectionId ?? null,
      itemId: parsed?.itemId ?? null,
      status: parsed?.status?.toUpperCase() || 'INCONCLUSIVE',
      comment: parsed?.comment || transcript,
      is24Hour: Boolean(parsed?.is24Hour),
      responsibility: parsed?.responsibility === 'tenant' ? 'tenant' : 'owner',
      success: true
    };

    if (req.user?.id) {
      await db('audit_trails').insert({
        user_id: req.user.id,
        agency_id: req.agencyId,
        action: 'voice_command',
        entity_type: 'inspection_voice_note',
        changes: {
          transcript,
          result: normalized
        }
      });
    }

    res.json(normalized);
  } catch (error) {
    logger.error('Voice command analysis error:', error);
    res.status(500).json({
      success: false,
      error: 'Voice command analysis failed'
    });
  }
});

// Generate inspection comment from voice
router.post('/transcribe', async (req, res) => {
  try {
    const { audioText, itemType, currentStatus } = req.body;

    if (!audioText) {
      return res.status(400).json({ error: 'Audio text required' });
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

    const prompt = `
      Convert the following voice notes into a professional HQS inspection comment.
      
      Voice Notes: "${audioText}"
      Item Type: ${itemType}
      Current Status: ${currentStatus}
      
      Requirements:
      - Use professional inspection terminology
      - Be specific about deficiencies or conditions
      - Include measurements or quantities if mentioned
      - Follow HUD reporting standards
      - Keep it concise but complete
      
      Return only the formatted comment text.
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const comment = response.text().trim();

    res.json({ comment });
  } catch (error) {
    logger.error('Transcription error:', error);
    res.status(500).json({ error: 'Transcription failed' });
  }
});

// Predict potential failures based on historical data
router.post('/predict', async (req, res) => {
  try {
    const { unitId, unitType, yearBuilt, previousInspections } = req.body;

    // Get historical deficiencies for similar units
    const historicalData = await db('deficiencies')
      .select(
        'deficiencies.item_id',
        'deficiencies.section_id',
        'deficiencies.is_24hour'
      )
      .count('* as occurrence_count')
      .leftJoin('inspections', 'deficiencies.inspection_id', 'inspections.id')
      .leftJoin('units', 'inspections.unit_id', 'units.id')
      .where('units.unit_type', unitType)
      .where('units.agency_id', req.agencyId)
      .modify(function(queryBuilder) {
        if (yearBuilt) {
          const range = 10; // +/- 10 years
          queryBuilder.whereBetween('units.year_built', 
            [yearBuilt - range, yearBuilt + range]);
        }
      })
      .groupBy('deficiencies.item_id', 'deficiencies.section_id', 'deficiencies.is_24hour')
      .orderBy('occurrence_count', 'desc')
      .limit(20);

    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

    const prompt = `
      Based on historical HQS inspection data, predict potential issues for this unit.
      
      Unit Type: ${unitType}
      Year Built: ${yearBuilt}
      Common Historical Issues: ${JSON.stringify(historicalData)}
      
      Provide predictions in JSON format:
      {
        "high_risk_items": [
          {
            "item": "item description",
            "probability": 0.0-1.0,
            "reason": "explanation"
          }
        ],
        "recommended_focus_areas": ["area1", "area2"],
        "preventive_measures": ["measure1", "measure2"]
      }
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    let predictions;
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        predictions = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      predictions = {
        high_risk_items: historicalData.slice(0, 5).map(item => ({
          item: `${item.section_id} - ${item.item_id}`,
          probability: item.occurrence_count / 100,
          reason: 'Based on historical frequency'
        })),
        recommended_focus_areas: ['Electrical', 'Plumbing', 'Safety'],
        preventive_measures: ['Regular maintenance', 'Tenant education']
      };
    }

    res.json(predictions);
  } catch (error) {
    logger.error('Prediction error:', error);
    res.status(500).json({ error: 'Prediction failed' });
  }
});

// Generate inspection summary
router.post('/summarize', async (req, res) => {
  try {
    const { inspectionData } = req.body;

    if (!inspectionData) {
      return res.status(400).json({ error: 'Inspection data required' });
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

    // Extract key information
    const failedItems = [];
    const emergencyItems = [];
    
    inspectionData.sections.forEach(section => {
      section.items.forEach(item => {
        if (item.status === 'FAIL') {
          failedItems.push(`${section.title} - ${item.label}: ${item.comment}`);
          if (item.is24Hour) {
            emergencyItems.push(`${section.title} - ${item.label}`);
          }
        }
      });
    });

    const prompt = `
      Generate a professional inspection summary for this HQS inspection.
      
      Unit Details: ${JSON.stringify(inspectionData.details)}
      Failed Items: ${failedItems.join('; ')}
      Emergency Items: ${emergencyItems.join('; ')}
      
      Include:
      1. Overall assessment
      2. Critical issues requiring immediate attention
      3. Standard deficiencies
      4. Recommendations for remediation
      5. Timeline for corrections
      
      Format as a professional report summary.
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const summary = response.text();

    res.json({ summary });
  } catch (error) {
    logger.error('Summary generation error:', error);
    res.status(500).json({ error: 'Summary generation failed' });
  }
});

// Validate inspection completeness
router.post('/validate', async (req, res) => {
  try {
    const { inspectionData } = req.body;

    const issues = [];
    const warnings = [];

    // Check all required sections present
    const requiredSections = ['living_room', 'kitchen', 'bathroom_1', 'health_safety'];
    const sectionIds = inspectionData.sections.map(s => s.id);
    
    requiredSections.forEach(required => {
      if (!sectionIds.includes(required)) {
        issues.push(`Missing required section: ${required}`);
      }
    });

    // Check all items evaluated
    inspectionData.sections.forEach(section => {
      section.items.forEach(item => {
        if (item.status === 'PENDING') {
          issues.push(`Unevaluated item: ${section.title} - ${item.label}`);
        }
        
        if (item.status === 'FAIL' && !item.comment) {
          warnings.push(`Failed item missing comment: ${section.title} - ${item.label}`);
        }
        
        if (item.is24Hour && item.status === 'FAIL' && !item.responsibility) {
          issues.push(`24-hour item missing responsibility: ${section.title} - ${item.label}`);
        }
      });
    });

    // Check signatures
    if (!inspectionData.signature_tenant && inspectionData.details.inspectionType !== 'Special') {
      warnings.push('Missing tenant signature');
    }

    const isValid = issues.length === 0;
    
    res.json({
      valid: isValid,
      issues,
      warnings,
      completeness: {
        total_items: inspectionData.sections.reduce((sum, s) => sum + s.items.length, 0),
        evaluated_items: inspectionData.sections.reduce((sum, s) => 
          sum + s.items.filter(i => i.status !== 'PENDING').length, 0)
      }
    });
  } catch (error) {
    logger.error('Validation error:', error);
    res.status(500).json({ error: 'Validation failed' });
  }
});

export default router;