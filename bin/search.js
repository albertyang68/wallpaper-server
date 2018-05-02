const path = require('path');
const BPromise = require('bluebird');

const reddit = require('./reddit');
const utils = require('./utils');
const config = require('../config.json');

function init() {
  let home;
  return utils.getHomeDir()
    .then((homeDir) => {
      if (config.storage === '') {
        home = path.join(homeDir, 'wallpaper-server');
      } else {
        home = path.join(config.storage, 'wallpaper-server');
      }
      return utils.createDir(home);
    })
    .then(() => BPromise.resolve(home))
    .catch(err => console.error('ERROR init: ', err));
}

function start() {
  init()
    .then(dir =>
      BPromise.each(config.reddit.query, query =>
        reddit.search(dir, query, config.reddit.subReddits)))
    .catch(err => console.error('ERROR start: ', err));
}

start();
