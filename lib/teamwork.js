const teamwork = require('teamwork-api');
const { parseURL } = require('whatwg-url');
require('dotenv').config();

const teamworkApi = teamwork(process.env.TW_API_TOKEN, process.env.TW_DOMAIN, true);


/**
 * Gets a Task ID from a Teamwork URL.
 *
 * The URL can be structure like the following:
 *  - example.com/task/5678
 *  - example.com/#/task/5678
 *  - example.com/projects/1234/task/5678
 *  - example.com/#/projects/1234/task/5678
 *
 * @param {string} inputUrl
 * @return {null|number}
 */
function getTaskIdFromUrl(inputUrl) {
  const url = parseURL(inputUrl);

  // Get th path from URL or from  fragment.
  let path = url.path;
  if (path.length === 0 || path[0] === '') {
    if (!url.fragment || url.fragment.length === 0) {
      return null;
    }
    path = url.fragment.split('/');
  }

  let taskIdKey;
  for (let i = 0; i < path.length; i++) {
    if (path[i] === 'tasks') {
      taskIdKey = i + 1;
    }
  }
  if (typeof path[taskIdKey] === 'undefined') {
    console.log(`Unable to get TaskID from: ${inputUrl}`);
    return null;
  }

  return path[taskIdKey] || null;
}


/**
 * Retreive structured data about a Flickr image from its URL. This method
 * encapsulates getting any information about the URL. The goal is to aggregate
 * all possibly required data.
 *
 * @param {string} inputUrl - An image URL
 * @returns {Promise.<Object>} An object which contains data about the photo at
 *     the URL
 */
function getTeamWorkUrlData(inputUrl) {
  const taskId = getTaskIdFromUrl(inputUrl);

  return (taskId) ?
    teamworkApi.tasks.get({}, taskId)
      .then(data => (data.STATUS === 'OK') ? data['todo-item'] : null) :
    new Promise(() => null);
}


exports.getTeamWorkUrlData = getTeamWorkUrlData;
