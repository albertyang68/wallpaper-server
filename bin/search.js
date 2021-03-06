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
    .catch(err => console.error(`ERROR search init ${err}`));
}

function startSearch() {
  init()
    .then(dir =>
      BPromise.each(config.reddit.query, query =>
        reddit.start(dir, config.reddit.subReddits, 'search', query)))
    .catch(err => console.error('ERROR start: ', err));
}

function startBrowse() {
  init()
    .then(dir => reddit.start(dir, config.reddit.subReddits, 'browse'))
    .catch(err => console.error('ERROR start: ', err));
}

// startSearch();
startBrowse();
