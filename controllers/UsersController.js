import sha1 from 'sha1';
import { ObjectId } from 'mongodb';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

module.exports.postNew = async (req, res) => {
  const { email, password } = req.body;
  if (!email) {
    return res.status(400).send({ error: 'Missing email' });
  }
  if (!password) {
    return res.status(400).send({ error: 'Missing password' });
  }
  const emailExist = await dbClient.usersCollection.findOne({ email });
  if (emailExist) {
    return res.status(400).json({ error: 'Already exist' });
  }
  const hashedPwd = sha1(password);

  let user;
  try {
    user = await dbClient.usersCollection.insertOne({ email, password: hashedPwd });
    return res.status(201).json({ id: user.insertedId, email });
  } catch (err) {
    return res.status(500).json({ error: 'Error can\'t create user' });
  }
};

module.exports.getMe = async (req, res) => {
  const token = req.header('X-Token');
  const key = `auth_${token}`;
  try {
    const userId = await redisClient.get(key);
    const user = await dbClient.usersCollection.findOne({ _id: ObjectId(userId) });
    if (user) {
      res.status(200).json({ id: user._id, email: user.email });
    } else res.status(401).json({ error: 'Unauthorized' });
  } catch (err) {
    res.status(401).json({ error: 'Unauthorized' });
  }
};
