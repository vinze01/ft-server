const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const dotenv = require('dotenv');

dotenv.config();
const secret = process.env.JWT_SECRET || 'f1n4nc3';

const register = async (req, res) => {
  const { username, password, firstName, middleName, lastName, contactNo, email } = req.body;
  try {
    console.log('req.body :>> ', req.body);
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({ 
      username, 
      password: hashedPassword,
      firstName,
      middleName,
      lastName,
      contactNo,
      email
    });
    res.status(201).json({ message: 'User created', userId: user.id });
  } catch (error) {
    res.status(500).json({ error: 'Error creating user' });
  }
};

const login = async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await User.findOne({ where: { username } });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    console.log('user :>> ', user);
    const token = jwt.sign({ userId: user.id }, secret, { expiresIn: '1h' });
    res.json({ token, user });
  } catch (error) {
    res.status(500).json({ error: 'Error logging in' });
  }
};

const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'No token provided' });

  const token = authHeader.split(' ')[1];
  jwt.verify(token, secret, (err, decoded) => {
    if (err) return res.status(403).json({ error: 'Failed to authenticate token' });
    req.userId = decoded.userId;
    next();
  });
};

module.exports = { register, login, authenticate };
