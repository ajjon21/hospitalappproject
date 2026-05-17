function ensureAuthenticated(req, res, next) {
  if (req.session?.user) {
    return next();
  }
  res.redirect('/login');
}

function authorizeRole(...allowedRoles) {
  return (req, res, next) => {
    const role = req.session?.user?.role;
    if (allowedRoles.includes(role)) {
      return next();
    }
    return res.status(403).json({ error: 'Forbidden: insufficient permissions' });
  };
}

module.exports = {
  ensureAuthenticated,
  authorizeRole,
};
