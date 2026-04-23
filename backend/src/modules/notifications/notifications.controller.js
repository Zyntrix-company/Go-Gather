const service = require('./notifications.service');

const getNotifications = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const result = await service.getNotifications(req.user.id, page);
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

const getUnreadCount = async (req, res, next) => {
  try {
    const unreadCount = await service.getUnreadCount(req.user.id);
    return res.status(200).json({ unreadCount });
  } catch (err) {
    next(err);
  }
};

const markRead = async (req, res, next) => {
  try {
    const result = await service.markRead(req.user.id, req.params.id);
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

const markAllRead = async (req, res, next) => {
  try {
    const result = await service.markAllRead(req.user.id);
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

module.exports = { getNotifications, getUnreadCount, markRead, markAllRead };
