/* eslint-disable no-useless-return */
import { ObjectId } from 'mongodb';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import mime from 'mime-types';
import Queue from 'bull';
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
  userId = user._id.toString();
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
    parentId: parentId ? ObjectId(parentId) : 0,
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
    res.status(201).json({
      id: newFile.insertedId,
      ...fileDocument,
      localPath: newFile.localPath,
    });
    // res.status(201).json({ id: newFile.insertedId, ...fileDocument });
    if (type === 'image') {
      const queue = new Queue('fileQueue');
      queue.add({ fileId: newFile.insertedId, userId });
    }
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
    return;
  }
  if (fileDocument) {
    res.status(200).json({ ...fileDocument });
    return;
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

module.exports.putPublish = async (req, res) => {
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
  const update = {
    $set: {
      isPublic: true,
    },
  };
  const fileDocument = await dbClient.filesCollection.findOneAndUpdate(
    {
      _id: ObjectId(req.params.id), userId: ObjectId(userId),
    }, update,
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
    res.status(200).send({ ...fileDocument.value, isPublic: true });
  }
};

module.exports.putUnpublish = async (req, res) => {
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
  const update = {
    $set: {
      isPublic: false,
    },
  };
  const fileDocument = await dbClient.filesCollection.findOneAndUpdate(
    {
      _id: ObjectId(req.params.id), userId: ObjectId(userId),
    }, update,
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
    res.status(200).send({ ...fileDocument.value, isPublic: false });
  }
};

module.exports.getFile = async (req, res) => {
  const fileDocument = await dbClient.filesCollection.findOne({ _id: ObjectId(req.params.id) });
  if (!fileDocument) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  const token = req.header('X-Token');
  const key = `auth_${token}`;
  const userId = await redisClient.get(key);
  const user = await dbClient.usersCollection.findOne({ _id: ObjectId(userId) });

  if ((!userId || !user || fileDocument.userId.toString() !== userId) && !fileDocument.isPublic) {
    res.status(404).json({ error: 'Not found' });
    return;
  }

  if (fileDocument.type === 'folder') {
    res.status(400).json({ error: 'A folder doesn\'t have content' });
    return;
  }

  if (!fs.existsSync(fileDocument.localPath)) {
    res.status(404).json({ error: 'Not found' });
    return;
  }

  let path = fileDocument.localPath;
  const { size } = req.query;
  if (size) {
    path = `${fileDocument.localPath}_${size}`;
  }
  const mimeType = mime.contentType(fileDocument.name);
  try {
    const data = await fs.promises.readFile(path);
    res.setHeader('Content-Type', mimeType);
    res.status(200).send(data);
  } catch (err) {
    res.status(404).json({ error: 'Not found' });
  }
};
