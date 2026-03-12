import SystemConfig from '../models/SystemConfig.js';

/**
 * GET /api/settings
 * Returns the current system configuration.
 * Response: { ok: true, data: { reportFilterEnabled: boolean } }
 */
export const getSettings = async (_req, res) => {
  try {
    const cfg = await SystemConfig.getSingleton();
    res.json({ ok: true, data: { reportFilterEnabled: cfg.reportFilterEnabled } });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
};

/**
 * PATCH /api/settings
 * Body: { reportFilterEnabled: boolean }
 * Updates the report filter toggle.
 * Response: { ok: true, data: { reportFilterEnabled: boolean } }
 */
export const updateSettings = async (req, res) => {
  try {
    const { reportFilterEnabled } = req.body;

    if (typeof reportFilterEnabled !== 'boolean') {
      return res.status(400).json({
        ok: false,
        message: 'reportFilterEnabled phải là boolean (true hoặc false)'
      });
    }

    const cfg = await SystemConfig.findOneAndUpdate(
      { _id: 'singleton' },
      { reportFilterEnabled },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    ).lean();

    res.json({ ok: true, data: { reportFilterEnabled: cfg.reportFilterEnabled } });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
};
