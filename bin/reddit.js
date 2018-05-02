const BPromise = require('bluebird');
const mime = require('mime-types');
const path = require('path');
const request = require('request');

const utils = require('./utils');
const config = require('../config.json');

const reddit = config.reddit;

function auth() {
  const user = reddit.user;
  const options = {
    method: 'POST',
    url: `${reddit.urls.api.general}/access_token`,
    auth: {
      user: user.clientId,
      pass: user.clientSecret,
    },
    form: { // Must in form
      grant_type: 'password',
      username: user.userName,
      password: user.password,
    },
  };

  return new BPromise((resolve, reject) => {
    request(options, (error, response) => {
      const body = JSON.parse(response.body);
      if (error || response.statusCode !== 200) {
        console.error('Reddit auth ', error);
        reject(error || (body && body.error));
      }

      resolve(body && body.access_token);
    });
  });
}

function downloadFile(url, dest, fileName) {
  let type;
  return new BPromise((resolve, reject) => {
    request
      .get({ url, encoding: 'binary' }, (err, response, body) => {
        if (err || !response) {
          console.error(`ERROR downloadFile ${err}`);
          reject(err);
        } else {
          type = mime.extension(response.headers['content-type']);
          if (type !== 'html' && response.statusCode < 400) {
            utils.writeToFile(path.join(dest, `${fileName}`), body, 'binary')
              .then(() => resolve())
              .catch(error => console.error(`ERROR downloadFile writeFile ${error}`));
          } else {
            resolve();
          }
        }
      });
  });
}

// Move files from dir/temp to dir/resolution based on image res
function relocateImages(dir, subReddits) {
  return BPromise
    .each(subReddits, subReddit =>
      utils.readDir(path.join(dir, subReddit, 'temp', 'normal'))
        .map(fileName => utils.getResolutionPromise(path.join(dir, subReddit, 'temp', 'normal', fileName))
          .tapCatch(err => console.error(`ERROR relocateImages getResolutionPromise ${err}`))
          .then(resolution => utils.findDestFolder(resolution.width, resolution.height, false))
          .tapCatch(err => console.error(`ERROR relocateImages findFolderFromRes ${err}`))
          .then(destFolderName => utils.moveFile(path.join(dir, subReddit, 'temp', 'normal', fileName), path.join(dir, subReddit, destFolderName, fileName)))
          .tapCatch(err => console.error(`ERROR relocateImages renameAsync ${err}`)))
        .catch(err => console.error(`ERROR relocateImages ${err}`)))
    .each(subReddit =>
      utils.readDir(path.join(dir, subReddit, 'temp', 'nsfw'))
        .map(fileName => utils.getResolutionPromise(path.join(dir, subReddit, 'temp', 'nsfw', fileName))
          .tapCatch(err => console.error(`ERROR relocateImages getResolutionPromise ${err}`))
          .then(resolution => utils.findDestFolder(resolution.width, resolution.height, true))
          .tapCatch(err => console.error(`ERROR relocateImages findFolderFromRes ${err}`))
          .then(destFolderName => utils.moveFile(path.join(dir, subReddit, 'temp', 'nsfw', fileName), path.join(dir, subReddit, destFolderName, fileName)))
          .tapCatch(err => console.error(`ERROR relocateImages renameAsync ${err}`)))
        .catch(err => console.error(`ERROR relocateImages ${err}`)));
}

function removeInvalidImg(home, subReddits) {
  return BPromise
    .each(subReddits, (subReddit) => {
      const dir = path.join(home, subReddit, 'others', 'normal');
      return utils.readDir(dir)
        .filter((fileName) => {
          const resolution = utils.getResolution(path.join(dir, fileName));
          return resolution.width === 161 && resolution.height === 81; // reddit invalid file
        })
        .each(invalidFileName => utils.deleteFile(path.join(dir, invalidFileName)))
        .catch(err => console.error(`ERROR removeInvalidImg ${err}`));
    })
    .each((subReddit) => {
      const dir = path.join(home, subReddit, 'others', 'nsfw');
      return utils.readDir(dir)
        .filter((fileName) => {
          const resolution = utils.getResolution(path.join(dir, fileName));
          return resolution.width === 161 && resolution.height === 81; // reddit invalid file
        })
        .each(invalidFileName => utils.deleteFile(path.join(dir, invalidFileName)))
        .catch(err => console.error(`ERROR removeInvalidImg ${err}`));
    });
}

function getImgFromResults(dir, results) {
  const subRedditName = results.subReddit;
  return BPromise.map(results.sources, (result) => {
    // isArray: reddit [{url, width, height, nsfw}]
    // isNotArray: imgur {name, url, nsfw}
    if (Array.isArray(result)) {
      return BPromise.map(result, source =>
        utils.findDestFolder(source.width, source.height, source.nsfw)
          .then(destFolder =>
            downloadFile(source.url, path.join(dir, subRedditName, destFolder), source.name))
          .tapCatch(err => console.error(`ERROR downloadFile ${err}`)));
    }
    return downloadFile(result.url, path.join(dir, subRedditName, 'temp', result.nsfw ? 'nsfw' : 'normal'), result.name)
      .catch((err) => {
        console.error(`ERROR getImgFromResults ${err}`);
      });
  })
    .catch(err => console.error(`ERROR getImgFromResults ${err}`));
}

function writeLastResultId(home, subReddit, id) {
  return utils.readDir(home)
    .then((fileNames) => {
      let prevRun = {};
      if (fileNames.includes('previous-run.json')) {
        return utils.readFromFile(path.join(home, 'previous-run.json'))
          .then((data) => {
            prevRun = JSON.parse(data);
            return BPromise.resolve(prevRun);
          })
          .catch(err => console.error(`ERROR writeLastResultId readFromFile ${err}`));
      }
      return BPromise.resolve(prevRun);
    })
    .then((prevRun) => {
      let modifiedRun = prevRun;
      modifiedRun[subReddit] = id;
      return BPromise.resolve(modifiedRun);
    })
    .then(modifiedRun => utils.writeToFile(path.join(home, 'previous-run.json'), JSON.stringify(modifiedRun)))
    .catch(err => console.error(`ERROR writeLastResultId ${err}`));
}

function readLastResultId(home, subReddit) {
  return utils.readFromFile(path.join(home, 'previous-run.json'))
    .then((data) => {
      let prevRun;
      try {
        prevRun = JSON.parse(data);
      } catch (e) {
        console.warn('WARN previous-run.json does not exist');
        return BPromise.resolve();
      }
      return BPromise.resolve(prevRun[subReddit]);
    });
}

function parseSearchedChildren(home, subReddit, resultsPerReddit) {
  // Extract images array from each children
  return BPromise.map(resultsPerReddit, (resultPerReddit, index, length) => {
    if (index === length - 1) {
      writeLastResultId(home, subReddit, `${resultPerReddit.kind}_${resultPerReddit.data.id}`);
    }

    // Extract source from each images if from Reddit
    if (resultPerReddit.data.preview) {
      return BPromise.map(resultPerReddit.data.preview.images, image =>
        BPromise.resolve(Object.assign(image.source, { name: resultPerReddit.data.name, nsfw: resultPerReddit.data.thumbnail === 'nsfw' })));
    }
    // Extract url from data if from other resources (eg. imgur)
    return BPromise.resolve({
      name: resultPerReddit.data.name,
      url: resultPerReddit.data.url,
      nsfw: resultPerReddit.data.thumbnail === 'nsfw',
    });
  });
}

function redditSearch(home, token, query, subReddits) {
  const queryParams = {
    q: query,
    restrict_sr: 'on', // restrict search to current subReddit
    include_over_18: 'on',
    limit: 100,
    sort: 'new',
    t: 'all',
    after: '',
  };

  return BPromise.map(subReddits, (subReddit) => {
    const options = {
      method: 'GET',
      url: `${reddit.urls.oauth}/r/${subReddit}/search.json`,
      auth: {
        bearer: token,
      },
      headers: {
        'User-Agent': 'wallpaper_server/0.1 by /u/yzq9652_test', // Required for 403 error
      },
      qs: queryParams,
    };

    return readLastResultId(home, subReddit)
      .then((id) => {
        if (id) {
          options.qs.after = id;
        }
        return BPromise.resolve(options);
      })
      .then(modifiedOptions => new BPromise((resolve, reject) => {
        // Search
        request(modifiedOptions, (error, response) => {
          let body;
          try {
            body = JSON.parse(response.body);
          } catch (e) {
            console.error(e);
            reject(e);
          }

          if (error || response.statusCode !== 200) {
            console.error('Reddit redditSearch ', error);
            reject(error);
          }
          parseSearchedChildren(home, subReddit, body.data && body.data.children)
            .then((sourceList) => {
              resolve({
                subReddit,
                sources: sourceList,
              });
            });
        });
      }));
  });
}

function search(home, query, subReddits) {
  BPromise.all(BPromise.each(subReddits, subReddit =>
    utils.createDir(path.join(home, subReddit))
      .then(() => utils.createDir(path.join(home, subReddit, '2560x1440')))
      .then(() => utils.createDir(path.join(home, subReddit, '2560x1440', 'normal')))
      .then(() => utils.createDir(path.join(home, subReddit, '2560x1440', 'nsfw')))
      .then(() => utils.createDir(path.join(home, subReddit, '1920x1080')))
      .then(() => utils.createDir(path.join(home, subReddit, '1920x1080', 'normal')))
      .then(() => utils.createDir(path.join(home, subReddit, '1920x1080', 'nsfw')))
      .then(() => utils.createDir(path.join(home, subReddit, 'others')))
      .then(() => utils.createDir(path.join(home, subReddit, 'others', 'normal')))
      .then(() => utils.createDir(path.join(home, subReddit, 'others', 'nsfw')))
      .then(() => utils.createDir(path.join(home, subReddit, 'large')))
      .then(() => utils.createDir(path.join(home, subReddit, 'large', 'normal')))
      .then(() => utils.createDir(path.join(home, subReddit, 'large', 'nsfw')))
      .then(() => utils.createDir(path.join(home, subReddit, 'temp')))
      .then(() => utils.createDir(path.join(home, subReddit, 'temp', 'normal')))
      .then(() => utils.createDir(path.join(home, subReddit, 'temp', 'nsfw')))))
    .then(() => auth())
    .then(accessToken => redditSearch(home, accessToken, query, subReddits))
    .map(sourceListPerReddit => getImgFromResults(home, sourceListPerReddit))
    .then(() => relocateImages(home, subReddits))
    .then(() => removeInvalidImg(home, subReddits))
    .catch((err) => {
      console.error('Reddit Search FAILED ', err);
    });
}

module.exports = {
  auth,
  search,
};
