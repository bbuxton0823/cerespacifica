import express from 'express';
import db from '../config/database.js';
import { requirePrivilege } from '../middleware/auth.js';
import { reportFilterSchema } from '../utils/validators.js';
import { logger } from '../utils/logger.js';
import { emitToAgency } from '../services/socketService.js';

const router = express.Router();

// Generate SEMAP report
router.post('/semap', requirePrivilege('generate_reports'), async (req, res) => {
  try {
    const { error, value } = reportFilterSchema.validate(req.body);
    
    if (error) {
      return res.status(400).json({ 
        error: 'Invalid report filters', 
        details: error.details.map(d => d.message) 
      });
    }

    // SEMAP metrics calculation
    const metrics = await db.transaction(async (trx) => {
      const filters = {
        agency_id: req.agencyId,
        ...value
      };

      // HQS Quality Control (14 indicators)
      const qualityControl = await trx('inspections')
        .count('* as total')
        .countDistinct('unit_id as unique_units')
        .where(filters)
        .first();

      // Pass/Fail rates
      const passFailRates = await trx('inspections')
        .select('status')
        .count('* as count')
        .where(filters)
        .groupBy('status');

      // 24-hour emergency response
      const emergencyResponse = await trx('deficiencies')
        .select('is_24hour', 'status')
        .count('* as count')
        .where('is_24hour', true)
        .whereIn('inspection_id', function() {
          this.select('id').from('inspections').where(filters);
        })
        .groupBy('is_24hour', 'status');

      // Average inspection completion time
      const avgCompletionTime = await trx('inspections')
        .select(trx.raw('AVG(EXTRACT(EPOCH FROM (completed_at - inspection_date))/3600) as avg_hours'))
        .where(filters)
        .whereNotNull('completed_at')
        .first();

      // Compile SEMAP scores
      const semap = {
        reporting_period: {
          from: value.from_date || new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
          to: value.to_date || new Date()
        },
        indicators: {
          proper_selection: calculateScore(qualityControl.unique_units, qualityControl.total),
          reasonable_rent: 100, // Would need rent data
          hqs_quality_control: calculateHQSScore(passFailRates),
          hqs_enforcement: calculateEnforcementScore(emergencyResponse),
          expanding_housing_opportunities: 85, // Would need geographic data
          fss_enrollment: 0, // Family Self-Sufficiency data needed
          fss_escrow: 0,
          lease_up: calculateLeaseUpRate(qualityControl.total),
          income_verification: 95, // Would need EIV data
          utility_allowances: 100,
          determination_of_rent: 100,
          pre_contract_hqs: calculatePreContractScore(passFailRates),
          annual_hqs: calculateAnnualScore(passFailRates),
          correct_tenant_rent: 100
        },
        overall_score: 0
      };

      // Calculate overall SEMAP score
      const scores = Object.values(semap.indicators);
      semap.overall_score = scores.reduce((a, b) => a + b, 0) / scores.length;

      return semap;
    });

    // Save report
    const [report] = await db('reports').insert({
      agency_id: req.agencyId,
      generated_by: req.user.id,
      type: 'SEMAP',
      filters: value,
      data: metrics,
      generated_at: new Date()
    }).returning('*');

    // Emit report ready
    emitToAgency(req.agencyId, 'report:ready', {
      reportId: report.id,
      type: 'SEMAP',
      generatedBy: req.user.id
    });

    res.json(report);
  } catch (error) {
    logger.error('Error generating SEMAP report:', error);
    res.status(500).json({ error: 'Failed to generate SEMAP report' });
  }
});

// Generate PHAS report
router.post('/phas', requirePrivilege('generate_reports'), async (req, res) => {
  try {
    const { error, value } = reportFilterSchema.validate(req.body);
    
    if (error) {
      return res.status(400).json({ 
        error: 'Invalid report filters', 
        details: error.details.map(d => d.message) 
      });
    }

    // PHAS indicators calculation
    const phasData = await db.transaction(async (trx) => {
      const filters = {
        agency_id: req.agencyId,
        ...value
      };

      // Physical Inspection (40% weight)
      const physicalScore = await calculatePhysicalScore(trx, filters);

      // Financial Assessment (25% weight)
      const financialScore = 85; // Would need financial data

      // Management Operations (25% weight)
      const managementScore = await calculateManagementScore(trx, filters);

      // Capital Fund (10% weight)
      const capitalScore = 90; // Would need capital fund data

      return {
        physical_inspection: physicalScore,
        financial_assessment: financialScore,
        management_operations: managementScore,
        capital_fund: capitalScore,
        weighted_score: (
          physicalScore * 0.40 +
          financialScore * 0.25 +
          managementScore * 0.25 +
          capitalScore * 0.10
        )
      };
    });

    // Save report
    const [report] = await db('reports').insert({
      agency_id: req.agencyId,
      generated_by: req.user.id,
      type: 'PHAS',
      filters: value,
      data: phasData,
      generated_at: new Date()
    }).returning('*');

    res.json(report);
  } catch (error) {
    logger.error('Error generating PHAS report:', error);
    res.status(500).json({ error: 'Failed to generate PHAS report' });
  }
});

// Get deficiency trends
router.get('/deficiency-trends', requirePrivilege('view_reports'), async (req, res) => {
  try {
    const { from_date, to_date, group_by = 'month' } = req.query;

    const trends = await db('deficiencies')
      .select(
        db.raw(`DATE_TRUNC('${group_by}', created_at) as period`),
        'section_id',
        'item_id',
        'is_24hour',
        'responsibility'
      )
      .count('* as count')
      .whereIn('inspection_id', function() {
        this.select('id')
          .from('inspections')
          .where('agency_id', req.agencyId);
      })
      .modify(function(queryBuilder) {
        if (from_date) queryBuilder.where('created_at', '>=', from_date);
        if (to_date) queryBuilder.where('created_at', '<=', to_date);
      })
      .groupBy('period', 'section_id', 'item_id', 'is_24hour', 'responsibility')
      .orderBy('period', 'desc');

    // Analyze recurring issues
    const recurring = trends
      .filter(t => t.count > 3)
      .map(t => ({
        ...t,
        severity: t.is_24hour ? 'critical' : 'standard'
      }));

    res.json({
      trends,
      recurring,
      summary: {
        total_deficiencies: trends.reduce((sum, t) => sum + parseInt(t.count), 0),
        emergency_count: trends.filter(t => t.is_24hour).reduce((sum, t) => sum + parseInt(t.count), 0),
        top_issues: getTopIssues(trends)
      }
    });
  } catch (error) {
    logger.error('Error fetching deficiency trends:', error);
    res.status(500).json({ error: 'Failed to fetch deficiency trends' });
  }
});

// Get compliance dashboard data
router.get('/compliance-dashboard', requirePrivilege('view_reports'), async (req, res) => {
  try {
    const { period = '30' } = req.query;
    const daysAgo = new Date();
    daysAgo.setDate(daysAgo.getDate() - parseInt(period));

    const dashboard = await db.transaction(async (trx) => {
      // Pass/fail rates
      const passFailRates = await trx('inspections')
        .select(
          db.raw("COUNT(CASE WHEN data->>'overallStatus' = 'PASS' THEN 1 END) as passed"),
          db.raw("COUNT(CASE WHEN data->>'overallStatus' = 'FAIL' THEN 1 END) as failed"),
          db.raw("COUNT(*) as total")
        )
        .where('agency_id', req.agencyId)
        .where('inspection_date', '>=', daysAgo)
        .first();

      // Inspector performance
      const inspectorPerformance = await trx('inspections')
        .select(
          'users.first_name',
          'users.last_name',
          'inspections.inspector_id'
        )
        .count('* as total_inspections')
        .avg('completion_time as avg_completion_time')
        .leftJoin('users', 'inspections.inspector_id', 'users.id')
        .where('inspections.agency_id', req.agencyId)
        .where('inspections.inspection_date', '>=', daysAgo)
        .groupBy('inspections.inspector_id', 'users.first_name', 'users.last_name');

      // 24-hour response rate
      const emergencyResponse = await trx('deficiencies')
        .select(
          db.raw("COUNT(CASE WHEN status = 'resolved' AND resolved_date <= due_date THEN 1 END) as on_time"),
          db.raw("COUNT(*) as total")
        )
        .where('is_24hour', true)
        .whereIn('inspection_id', function() {
          this.select('id')
            .from('inspections')
            .where('agency_id', req.agencyId)
            .where('inspection_date', '>=', daysAgo);
        })
        .first();

      // Average days to resolution
      const resolutionTime = await trx('deficiencies')
        .select(
          db.raw("AVG(EXTRACT(EPOCH FROM (resolved_date - created_at))/86400) as avg_days")
        )
        .where('status', 'resolved')
        .whereIn('inspection_id', function() {
          this.select('id')
            .from('inspections')
            .where('agency_id', req.agencyId)
            .where('inspection_date', '>=', daysAgo);
        })
        .first();

      return {
        period: {
          from: daysAgo,
          to: new Date()
        },
        metrics: {
          pass_rate: passFailRates.total > 0 ? 
            (passFailRates.passed / passFailRates.total * 100).toFixed(1) : 0,
          total_inspections: passFailRates.total,
          inspector_performance: inspectorPerformance,
          emergency_response_rate: emergencyResponse.total > 0 ?
            (emergencyResponse.on_time / emergencyResponse.total * 100).toFixed(1) : 100,
          avg_resolution_days: resolutionTime.avg_days ? 
            parseFloat(resolutionTime.avg_days).toFixed(1) : 0
        }
      };
    });

    res.json(dashboard);
  } catch (error) {
    logger.error('Error fetching compliance dashboard:', error);
    res.status(500).json({ error: 'Failed to fetch compliance dashboard' });
  }
});

// Export report as CSV
router.get('/:id/export', requirePrivilege('view_reports'), async (req, res) => {
  try {
    const report = await db('reports')
      .where('id', req.params.id)
      .where('agency_id', req.agencyId)
      .first();

    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    // Convert JSON data to CSV format
    const csv = jsonToCSV(report.data);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${report.type}-${report.id}.csv"`);
    res.send(csv);
  } catch (error) {
    logger.error('Error exporting report:', error);
    res.status(500).json({ error: 'Failed to export report' });
  }
});

// Helper functions
function calculateScore(numerator, denominator) {
  if (denominator === 0) return 0;
  return Math.min(100, (numerator / denominator * 100));
}

function calculateHQSScore(passFailRates) {
  const total = passFailRates.reduce((sum, r) => sum + parseInt(r.count), 0);
  const passed = passFailRates.find(r => r.status === 'complete')?.count || 0;
  return calculateScore(passed, total);
}

function calculateEnforcementScore(emergencyResponse) {
  const total = emergencyResponse.reduce((sum, r) => sum + parseInt(r.count), 0);
  const resolved = emergencyResponse.filter(r => r.status === 'resolved')
    .reduce((sum, r) => sum + parseInt(r.count), 0);
  return calculateScore(resolved, total);
}

function calculateLeaseUpRate(totalInspections) {
  // Simplified calculation
  return Math.min(100, totalInspections * 2);
}

function calculatePreContractScore(passFailRates) {
  const initial = passFailRates.filter(r => r.inspection_type === 'Initial');
  return calculateHQSScore(initial);
}

function calculateAnnualScore(passFailRates) {
  const annual = passFailRates.filter(r => r.inspection_type === 'Annual');
  return calculateHQSScore(annual);
}

async function calculatePhysicalScore(trx, filters) {
  const inspections = await trx('inspections')
    .count('* as total')
    .where(filters)
    .where('status', 'complete')
    .first();
  
  // Simplified calculation - would need detailed scoring
  return Math.min(100, inspections.total * 0.5 + 50);
}

async function calculateManagementScore(trx, filters) {
  const metrics = await trx('inspections')
    .select(
      db.raw("AVG(EXTRACT(EPOCH FROM (completed_at - inspection_date))/86400) as avg_days")
    )
    .where(filters)
    .first();
  
  // Score based on average completion time
  const days = metrics.avg_days || 30;
  return Math.max(0, Math.min(100, 100 - (days - 1) * 5));
}

function getTopIssues(trends) {
  const issueCounts = {};
  trends.forEach(t => {
    const key = `${t.section_id}-${t.item_id}`;
    issueCounts[key] = (issueCounts[key] || 0) + parseInt(t.count);
  });
  
  return Object.entries(issueCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([key, count]) => ({ issue: key, count }));
}

function jsonToCSV(data) {
  if (!data || typeof data !== 'object') return '';
  
  // Flatten nested objects
  const flat = flattenObject(data);
  const headers = Object.keys(flat);
  const values = Object.values(flat);
  
  return headers.join(',') + '\n' + values.join(',');
}

function flattenObject(obj, prefix = '') {
  return Object.keys(obj).reduce((acc, key) => {
    const pre = prefix.length ? `${prefix}.` : '';
    if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
      Object.assign(acc, flattenObject(obj[key], pre + key));
    } else {
      acc[pre + key] = obj[key];
    }
    return acc;
  }, {});
}

export default router;