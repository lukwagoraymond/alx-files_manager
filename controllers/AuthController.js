import sha1 from 'sha1';

import { v4 as uuidv4 } from 'uuid';
import { ObjectId } from 'mongodb';

import redisClient from '../utils/redis';
import dbClient from '../utils/db';

module.exports.getConnect = async (req, res) => {
  const basicAuth = req.header('Authorization');
  if (basicAuth.startsWith('Basic') && req.header('Authorization')) {
    // eslint-disable-next-line prefer-destructuring
    const credentials = basicAuth.split(' ')[1];
    const decodedToken = Buffer.from(credentials, 'base64').toString('utf-8');
    const loginData = decodedToken.split(':');
    if (loginData.length !== 2) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const [email, password] = loginData;
    const user = await dbClient.usersCollection.findOne({ email, password: sha1(password) });
    if (user) {
      const token = uuidv4();
      const key = `auth_${token}`;
      const expirationHours = 24;
      await redisClient.set(key, user._id.toString(), expirationHours * 3600);
      res.status(200).json({ token });
      return;
    }
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
    }
  }
};

module.exports.getDisconnect = async (req, res) => {
  const token = req.header('X-Token');
  const key = `auth_${token}`;
  try {
    const userId = await redisClient.get(key);
    const user = dbClient.usersCollection.findOne({ _id: ObjectId(userId) });
    if (user) {
      await redisClient.del(key);
      res.status(204).send();
    }
  } catch (err) {
    res.status(401).json({ error: 'Unauthorized' });
  }
};
