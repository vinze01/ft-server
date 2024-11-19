const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const dotenv = require("dotenv");
const path = require("path");
const fs = require("fs");

dotenv.config();
const secret = process.env.JWT_SECRET || 'f1n4nc3';

const register = async (req, res) => {
  const { username, password, firstName, middleName, lastName, contactNo, email } = req.body;
  const avatar = req.file ? req.file.filename : null;
  console.log('req.file :>> ', req.file); //undefined TODO: upload avatar

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({
      username,
      password: hashedPassword,
      firstName,
      middleName,
      lastName,
      contactNo,
      email,
      avatar,
    });
    res.status(201).json({ message: "User created", userId: user.id });
  } catch (error) {
    res.status(500).json({ error: "Error creating user" });
  }
};

const login = async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username && !password) {
      console.log('NO INPUTS');
      return res.send({ error: 'Please enter username and password' })
    }
    const user = await User.findOne({ where: { username } });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const userObject = user.get();
    const token = jwt.sign({ userId: user.id }, secret, { expiresIn: '1h' });
    res.send({ token, user: userObject });
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
