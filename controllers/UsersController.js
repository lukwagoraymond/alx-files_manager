import sha1 from 'sha1';
import dbClient from '../utils/db';

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
    return res.status(400).send('Already exist');
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
