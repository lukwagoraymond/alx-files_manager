import redisClient from '../utils/redis';
import dbClient from '../utils/db';

module.exports.getStatus = (req, res) => {
  const redisStatus = redisClient.isAlive();
  const dbStatus = dbClient.isAlive();
  if (redisStatus && dbStatus) {
    return res.status(200).json({ redis: true, db: true });
  }
  // eslint-disable-next-line consistent-return, no-useless-return
  return;
};

module.exports.getStats = async (req, res) => {
  const userCount = await dbClient.nbUsers();
  const fileCount = await dbClient.nbFiles();
  return res.status(200).json({ users: userCount, files: fileCount });
};
