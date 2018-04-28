const sizeOf = require('image-size');
const request = require('request');
const path = require('path');
const BPromise = require('bluebird');

const mkdir = BPromise.promisify(require('fs').mkdir);
const writeFile = BPromise.promisify(require('fs').writeFile);
const rename = BPromise.promisify(require('fs').rename);
const readdir = BPromise.promisify(require('fs').readdir);
const unlink = BPromise.promisify(require('fs').unlink);


// File Operation
function writeToFile(filePath, data, options = 'utf8') {
  return writeFile(filePath, data, options)
    .tap(() => console.log(`LOG writeToFile done ${filePath}`))
    .catch(err => console.warn(`WARN writeToFile ${filePath} ${err}`));
}

function moveFile(oldPath, newPath) {
  return rename(oldPath, newPath)
    .tap(() => console.log(`LOG moveFile to ${newPath}`))
    .catch(err => console.warn(`WARN moveFile ${newPath} ${err}`));
}

function deleteFile(filePath) {
  return unlink(filePath)
    .tap(() => console.log(`LOG deleteFile to ${filePath}`))
    .catch(err => console.warn(`WARN deleteFile ${err}`));
}


// Folder Operation
function createDir(folderPath) {
  return mkdir(folderPath)
    .tap(() => console.log(`LOG createDir done ${folderPath}`))
    .catch(err => console.warn(`WARN createDir ${folderPath} ${err}`));
}

function readDir(folderPath) {
  return readdir(folderPath)
    .tap(() => console.log(`LOG readDir to ${folderPath}`))
    .catch(err => console.warn(`WARN readDir ${folderPath} ${err}`));
}

function removeDir(folderPath) {
  return readDir(folderPath)
    .map(fileName => deleteFile(path.join(folderPath, fileName)))
    .tap(() => console.log(`LOG removeDir to ${folderPath}`))
    .catch(err => console.warn(`WARN removeDir ${folderPath} ${err}`));
}

function isEmptyDir(folderPath) {
  return readDir(folderPath)
    .then(files => BPromise.resolve(!files.length));
}


// Request
function requestAsync(options) {
  return new BPromise((resolve, reject) => {
    request(options, (error, response, body) => {
      if (error || response.statusCode !== 200) {
        console.error(`ERROR requestAsync options: ${options}, error: ${error}`);
        reject(error || (response.body && response.body.error));
      }
      resolve(JSON.parse(body));
    });
  });
}


// Others
function findFolderFromRes(width, height) {
  if ((width >= 2400 && width <= 2560) && (height >= 1300 && height <= 1640)) {
    return BPromise.resolve('2560x1440');
  } else if ((width >= 1800 && width <= 2020) && (height >= 900 && height <= 1280)) {
    return BPromise.resolve('1920x1080');
  } else if (width >= 2560 && height >= 1640) {
    return BPromise.resolve('large');
  }
  return BPromise.resolve('others');
}

function getResolutionPromise(filePath) {
  return new BPromise((resolve, reject) => {
    sizeOf(filePath, (err, dimensions) => {
      if (err) {
        console.error(`ERROR getResolution ${err}`);
        reject(err);
      }
      resolve(dimensions);
    });
  });
}

function getResolution(filePath) {
  return sizeOf(filePath);
}

function getHomeDir() {
  return BPromise.resolve(process.env[(process.platform === 'win32') ? 'USERPROFILE' : 'HOME']);
}

module.exports = {
  getHomeDir,
  createDir,
  moveFile,
  readDir,
  deleteFile,
  removeDir,
  requestAsync,
  isEmptyDir,
  writeToFile,
  findFolderFromRes,
  getResolution,
  getResolutionPromise,
};
