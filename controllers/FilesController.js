import { ObjectId } from 'mongodb';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import redisClient from '../utils/redis';
import dbClient from '../utils/db';

module.exports.postUpload = async (req, res) => {
  const token = req.header('X-Token');
  const key = `auth_${token}`;
  let userId = await redisClient.get(key);
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const user = await dbClient.usersCollection.findOne({ _id: ObjectId(userId) });
  if (!user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  userId = user._id;
  const {
    name, type, isPublic = false, data,
  } = req.body;
  let { parentId = 0 } = req.body;
  const typeIncludes = ['folder', 'file', 'image'];
  if (parentId === '0') parentId = 0;

  if (!name) {
    res.status(400).json({ error: 'Missing name' });
    return;
  }
  if (!type || !typeIncludes.includes(type)) {
    res.status(400).json({ error: 'Missing Type' });
    return;
  }
  if (!data && type !== 'folder') {
    res.status(400).json({ error: 'Missing data' });
    return;
  }
  if (parentId) {
    const file = await dbClient.filesCollection.findOne({ _id: ObjectId(parentId) });
    if (file && file.type !== 'folder') {
      res.status(400).json({ error: 'Parent is not a folder' });
    } else if (!file) {
      res.status(400).json({ error: 'Parent not found' });
      return;
    }
  }
  const fileDocument = {
    name,
    userId,
    type,
    parentId: parentId ? ObjectId(parentId) : '0',
    isPublic: isPublic || false,
  };
  if (type === 'folder') {
    const newFileDocument = await dbClient.filesCollection.insertOne({ ...fileDocument });
    res.status(201).json({ id: newFileDocument.insertedId, ...fileDocument });
    return;
  }
  if (type === 'file' || type === 'image') {
    const relativePath = process.env.FOLDER_PATH || '/tmp/files_manager';
    const fileName = uuidv4();
    const fullPath = `${relativePath}/${fileName}`;
    fs.access(relativePath, (err) => {
      if (err) {
        fs.mkdirSync(relativePath, { recursive: true });
      }
      fs.writeFile(fullPath, data, { encoding: 'base64' }, (err) => {
        if (err) {
          console.log(err);
        }
      });
    });
    const newFile = await dbClient.filesCollection.insertOne({
      ...fileDocument,
      localPath: fullPath,
    });
    res.status(201).json({ id: newFile.insertedId, ...fileDocument });
  }
};

module.exports.getShow = async (req, res) => {
  const token = req.header('X-Token');
  const key = `auth_${token}`;
  let userId = await redisClient.get(key);
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const user = await dbClient.usersCollection.findOne({ _id: ObjectId(userId) });
  if (!user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  userId = user._id;
  const fileDocument = await dbClient.filesCollection.findOne(
    {
      _id: ObjectId(req.params.id), userId: ObjectId(userId),
    },
    {
      projection: {
        id: '$_id',
        _id: 0,
        name: 1,
        type: 1,
        isPublic: 1,
        parentId: 1,
        userId: 1,
      },
    },
  );
  if (!fileDocument) {
    res.status(404).json({ error: 'Not found' });
  } else {
    res.status(200).json({ ...fileDocument });
  }
};

module.exports.getIndex = async (req, res) => {
  const token = req.header('X-Token');
  const key = `auth_${token}`;
  let userId = await redisClient.get(key);
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const user = await dbClient.usersCollection.findOne({ _id: ObjectId(userId) });
  if (!user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  userId = user._id;
  const { parentId } = req.query;
  let parentIdVal = req.query.parentId;
  if (parentIdVal === '0') parentIdVal = 0;
  let page = Number(req.query.page) || 0;
  if (Number.isNaN(page)) page = 0;

  /* if (Object.keys(req.query).length === 0) {
    const listFiles = await dbClient.filesCollection.find({},
      {
        projection: {
          id: '$_id',
          _id: 0,
          name: 1,
          type: 1,
          isPublic: 1,
          parentId: 1,
          userId: 1,
        },
      })
      .skip(20 * page)
      .limit(20)
      .toArray();
    res.status(200).send(listFiles);
    return;
  } */
  let filter;
  if (parentId) {
    filter = { parentId: ObjectId(parentIdVal) };
  } else {
    filter = {};
  }
  const fileDocuments = await dbClient.filesCollection.aggregate(
    [
      { $match: { $or: [filter, { parentId: 0 }] } },
      { $skip: 20 * page },
      { $limit: 20 },
      {
        $project: {
          id: '$_id', _id: 0, name: 1, type: 1, isPublic: 1, parentId: 1, userId: 1,
        },
      },
    ],
  ).toArray();
  res.status(200).send(fileDocuments);
};
