/**
 * Accounts API Server - Simple Version
 * 
 * SETUP:
 * 1. npm install
 * 2. Create .env file with MONGODB_URI
 * 3. npm start
 * 
 * That's it!
 */

const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { MongoClient } = require('mongodb');

const app = express();
const PORT = process.env.PORT || 3000;

let db = null;

// Simple CORS - allow all origins
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: db ? 'ok' : 'waiting',
    database: db ? 'connected' : 'connecting'
  });
});

// ============================================================================
// ACCOUNTS API: Get comprehensive account details
// ============================================================================
app.get('/api/accounts/:userId', async (req, res) => {
  const { userId } = req.params;

  if (!userId) {
    return res.status(400).json({ 
      success: false, 
      error: 'User ID required' 
    });
  }

  try {
    if (!db) {
      return res.status(503).json({ 
        success: false, 
        error: 'Database not connected' 
      });
    }

    // Fetch account profile
    const profile = await db.collection('users').findOne({ 
      $or: [
        { _id: userId },
        { discordId: userId }
      ]
    });

    // Fetch absences
    const absences = await db.collection('absences')
      .find({ userId: userId })
      .toArray();

    // Fetch payslips
    const payslips = await db.collection('payslips')
      .find({ userId: userId })
      .toArray();

    // Fetch disciplinaries
    const disciplinaries = await db.collection('disciplinaries')
      .find({ userId: userId })
      .toArray();

    // Fetch requests
    const requests = await db.collection('requests')
      .find({ userId: userId })
      .toArray();

    // Fetch reports
    const reports = await db.collection('reports')
      .find({ userId: userId })
      .toArray();

    // Return comprehensive account data
    res.json({
      success: true,
      account: {
        userId: userId,
        profile: profile ? {
          id: profile._id,
          name: profile.name || '',
          email: profile.email || '',
          department: profile.department || '',
          discordId: profile.discordId || '',
          timezone: profile.timezone || '',
          country: profile.country || '',
          dateOfSignup: profile.dateOfSignup || '',
          suspended: profile.suspended || false,
          baseLevel: profile.baseLevel || '',
          role: profile.role || ''
        } : null,
        absences: absences.map(a => ({
          id: a._id?.toString(),
          name: a.name,
          startDate: a.startDate,
          endDate: a.endDate,
          reason: a.reason,
          totalDays: a.totalDays,
          comment: a.comment,
          status: a.status,
          approvedBy: a.approvedBy,
          timestamp: a.timestamp
        })),
        payslips: payslips.map(p => ({
          id: p._id?.toString(),
          period: p.period,
          assignedBy: p.assignedBy,
          link: p.link,
          dateAssigned: p.dateAssigned,
          status: p.status,
          acknowledged: p.acknowledged
        })),
        disciplinaries: disciplinaries.map(d => ({
          id: d._id?.toString(),
          strikeType: d.strikeType,
          reason: d.reason,
          assignedBy: d.assignedBy,
          timestamp: d.timestamp,
          status: d.status
        })),
        requests: requests.map(r => ({
          id: r._id?.toString(),
          type: r.type,
          comment: r.comment,
          status: r.status,
          timestamp: r.timestamp
        })),
        reports: reports.map(r => ({
          id: r._id?.toString(),
          type: r.type,
          comment: r.comment,
          scale: r.scale,
          publishedBy: r.publishedBy,
          status: r.status,
          timestamp: r.timestamp
        })),
        summary: {
          totalAbsences: absences.length,
          approvedAbsences: absences.filter(a => a.status === 'Approved').length,
          pendingAbsences: absences.filter(a => a.status === 'Pending').length,
          totalDisciplinaries: disciplinaries.length,
          totalPayslips: payslips.length,
          pendingRequests: requests.filter(r => r.status === 'Submit').length,
          totalReports: reports.length
        }
      }
    });

  } catch (error) {
    console.error('[ACCOUNTS] Error fetching account:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// ============================================================================
// USER PROFILE: Get just the profile information
// ============================================================================
app.get('/api/user/profile/:userId', async (req, res) => {
  const { userId } = req.params;

  try {
    if (!db) {
      return res.status(503).json({ success: false, error: 'Database not connected' });
    }

    const profile = await db.collection('users').findOne({
      $or: [
        { _id: userId },
        { discordId: userId }
      ]
    });

    if (!profile) {
      return res.status(404).json({ 
        success: false, 
        error: 'User not found' 
      });
    }

    res.json({
      success: true,
      profile: {
        id: profile._id,
        name: profile.name,
        email: profile.email,
        department: profile.department,
        discordId: profile.discordId,
        timezone: profile.timezone,
        country: profile.country,
        dateOfSignup: profile.dateOfSignup,
        suspended: profile.suspended,
        baseLevel: profile.baseLevel,
        role: profile.role
      }
    });

  } catch (error) {
    console.error('[USER PROFILE] Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// ABSENCES: Get user absences
// ============================================================================
app.get('/api/user/absences/:userId', async (req, res) => {
  const { userId } = req.params;

  try {
    if (!db) {
      return res.status(503).json({ success: false, error: 'Database not connected' });
    }

    const absences = await db.collection('absences')
      .find({ userId: userId })
      .toArray();

    res.json({
      success: true,
      absences: absences.map(a => ({
        id: a._id?.toString(),
        name: a.name,
        startDate: a.startDate,
        endDate: a.endDate,
        reason: a.reason,
        totalDays: a.totalDays,
        comment: a.comment,
        status: a.status,
        approvedBy: a.approvedBy,
        timestamp: a.timestamp
      }))
    });

  } catch (error) {
    console.error('[ABSENCES] Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// PAYSLIPS: Get user payslips
// ============================================================================
app.get('/api/user/payslips/:userId', async (req, res) => {
  const { userId } = req.params;

  try {
    if (!db) {
      return res.status(503).json({ success: false, error: 'Database not connected' });
    }

    const payslips = await db.collection('payslips')
      .find({ userId: userId })
      .toArray();

    res.json({
      success: true,
      payslips: payslips.map(p => ({
        id: p._id?.toString(),
        period: p.period,
        assignedBy: p.assignedBy,
        link: p.link,
        dateAssigned: p.dateAssigned,
        status: p.status,
        acknowledged: p.acknowledged
      }))
    });

  } catch (error) {
    console.error('[PAYSLIPS] Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// DISCIPLINARIES: Get user disciplinaries
// ============================================================================
app.get('/api/user/disciplinaries/:userId', async (req, res) => {
  const { userId } = req.params;

  try {
    if (!db) {
      return res.status(503).json({ success: false, error: 'Database not connected' });
    }

    const disciplinaries = await db.collection('disciplinaries')
      .find({ userId: userId })
      .toArray();

    res.json({
      success: true,
      disciplinaries: disciplinaries.map(d => ({
        id: d._id?.toString(),
        strikeType: d.strikeType,
        reason: d.reason,
        assignedBy: d.assignedBy,
        timestamp: d.timestamp,
        status: d.status
      }))
    });

  } catch (error) {
    console.error('[DISCIPLINARIES] Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// REQUESTS: Get user requests
// ============================================================================
app.get('/api/user/requests/:userId', async (req, res) => {
  const { userId } = req.params;

  try {
    if (!db) {
      return res.status(503).json({ success: false, error: 'Database not connected' });
    }

    const requests = await db.collection('requests')
      .find({ userId: userId })
      .toArray();

    res.json({
      success: true,
      requests: requests.map(r => ({
        id: r._id?.toString(),
        type: r.type,
        comment: r.comment,
        status: r.status,
        timestamp: r.timestamp
      }))
    });

  } catch (error) {
    console.error('[REQUESTS] Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// REPORTS: Get user reports
// ============================================================================
app.get('/api/user/reports/:userId', async (req, res) => {
  const { userId } = req.params;

  try {
    if (!db) {
      return res.status(503).json({ success: false, error: 'Database not connected' });
    }

    const reports = await db.collection('reports')
      .find({ userId: userId })
      .toArray();

    res.json({
      success: true,
      reports: reports.map(r => ({
        id: r._id?.toString(),
        type: r.type,
        comment: r.comment,
        scale: r.scale,
        publishedBy: r.publishedBy,
        status: r.status,
        timestamp: r.timestamp
      }))
    });

  } catch (error) {
    console.error('[REPORTS] Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// START SERVER
// ============================================================================

async function start() {
  // Connect to MongoDB
  if (process.env.MONGODB_URI) {
    try {
      const client = new MongoClient(process.env.MONGODB_URI);
      await client.connect();
      db = client.db(process.env.DB_NAME || 'timeclock');
      console.log('✅ MongoDB connected');
    } catch (error) {
      console.error('❌ MongoDB connection failed:', error.message);
      console.log('⚠️  Server will run but database endpoints will fail');
    }
  } else {
    console.warn('⚠️  MONGODB_URI not set - configure it in .env file');
  }

  // Start server
  app.listen(PORT, () => {
    console.log(`\n✅ Accounts API running on http://localhost:${PORT}\n`);
    console.log(`📝 Add to your frontend:`);
    console.log(`   localStorage.setItem('ACCOUNTS_API_URL', 'http://localhost:${PORT}');\n`);
  });
}

// Shutdown
process.on('SIGINT', () => {
  console.log('\n📋 Shutting down...');
  process.exit(0);
});

start().catch(err => {
  console.error('Failed to start:', err);
  process.exit(1);
});
