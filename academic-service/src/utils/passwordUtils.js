const bcrypt = require('bcryptjs');

const saltRounds = 10;

exports.hashPassword = async (password) => {
  return bcrypt.hash(password, saltRounds);
};

exports.comparePassword = async (password, hash) => {
  return bcrypt.compare(password, hash);
};