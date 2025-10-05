import express from 'express';
import bcrypt from 'bcrypt';
import { User } from '../models/User.js';

const router = express.Router();

router.get('/login', (req, res) => {
  if (req.session.user) return res.redirect('/admin');
  res.render('admin/login', { title: 'Admin Login', error: null, layout: false });
});

router.post('/login', async (req, res) => {
  try {
    const { email = '', password = '' } = req.body;
    const user = await User.findOne({ where: { email } });
    if (!user)
      return res.render('admin/login', { title: 'Admin Login', error: 'User not found', layout: false });

    const ok = await bcrypt.compare(password, user.password_hash || '');
    if (!ok)
      return res.render('admin/login', { title: 'Admin Login', error: 'Invalid password', layout: false });

    req.session.user = { id: user.id, email: user.email, name: user.fullname || user.email };
    res.redirect('/admin');
  } catch (e) {
    console.error('[Admin Login Error]', e);
    res.render('admin/login', { title: 'Admin Login', error: 'Login failed', layout: false });
  }
});

router.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/admin/login'));
});

export default router;
