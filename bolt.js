const { getTeamWorkUrlData } = require('./lib/teamwork');
require('dotenv').config();
const keyBy = require('lodash.keyby');
const omit = require('lodash.omit');
const mapValues = require('lodash.mapvalues');
const { App } = require('@slack/bolt');
const DEBUG = process.env.DEBUG || false;

const debugPrint = (DEBUG) ? function debugPrint(name, data) {
  console.log(`---- START ${name} ----`);
  console.log(data);
  console.log(`---- END ${name} ----`);

  return data;
} : (name, data) => data;

const invalidTaskAnswer = {
  blocks: [
    {
      type: 'context',
      elements: [
        {
          type: 'plain_text',
          text: 'TW API error or Invalid Task.',
        },
      ],
    },
  ],
};

/**
 * Transform a Slack link into a Slack message attachment.
 *
 * @param {Object} link - Slack link
 * @param {string} link.url - The URL of the link
 *
 * @returns {Promise.<Object>} An object described by the Slack message
 *     attachment structure. In addition to the properties described in the API
 *     documentation, an additional `url` property is defined so the source of
 *     the attachment is captured. See:
 *     https://api.slack.com/docs/message-attachments
 */
function messageAttachmentFromLink(link) {
  return getTeamWorkUrlData(link.url)
    .then((twTask) => {
      debugPrint('Teamwork Task', twTask);
      if (!twTask) {
        return Object.assign(invalidTaskAnswer, { url: link.url });
      }

      const attachment = {
        url: link.url,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*Task:* <${link.url}|${twTask.content} (Status: ${twTask.status})>`,
            },
          },
          {
            type: 'context',
            elements: [
              {
                type: 'plain_text',
                text: `Created by: ${twTask['creator-firstname']} ${twTask['creator-lastname']}`,
              },
            ],
          },
          {
            type: 'divider',
          },
        ],
      };

      // Conditionally add fields as long as the data is available
      const fieldsBlock = {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Project:*\n<https://${link.domain}/projects/${twTask['project-id']}|${twTask['project-name']}>`,
          },
          {
            type: 'mrkdwn',
            text: `*Status:*\n${twTask.status}`,
          },
          {
            type: 'mrkdwn',
            text: `*List:*\n<https://${link.domain}/tasklists/${twTask['todo-list-id']}|${twTask['todo-list-name']}>`,
          },
        ],
      };

      if (twTask['parent-task']) {
        fieldsBlock.fields.push({
          type: 'mrkdwn',
          text: `*Parent:*\n<https://${link.domain}/tasks/${twTask['parent-task'].id}|${twTask['parent-task'].content}>`,
        });
      }
      if (twTask.boardColumn) {
        fieldsBlock.fields.push({
          type: 'mrkdwn',
          text: `*Board:*\n${twTask.boardColumn.name}`,
        });
      }
      if (twTask['due-date']) {
        fieldsBlock.fields.push({
          type: 'mrkdwn',
          text: `*Due:*\n${(new Date(twTask['due-date'])).toUTCString()}`,
        });
      }
      if (twTask['estimated-minutes']) {
        const hours = Math.floor(twTask['estimated-minutes'] / 60);
        const minutes = twTask['estimated-minutes'] % 60;
        fieldsBlock.fields.push({
          type: 'mrkdwn',
          text: `*Estimated:*\n${hours}:${minutes}`,
        });
      }
      attachment.blocks.push(fieldsBlock);

      return attachment;
    })
    .catch(() => Object.assign(invalidTaskAnswer, { url: link.url }));
}

const app = new App({
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  token: process.env.SLACK_BOT_TOKEN,
});

// Handle the event from the Slack Events API
app.event('link_shared', async ({ event, client }) => {
  debugPrint('Slack Event', event);

  // Call a helper that transforms the URL into a promise for an attachment suitable for Slack
  await Promise.all(event.links.map(messageAttachmentFromLink))
      // Transform the array of attachments to an unfurls object keyed by URL
      .then(attachments => keyBy(attachments, 'url'))
      .then(unfurls => mapValues(unfurls, attachment => omit(attachment, 'url')))
      // Invoke the Slack Web API to append the attachment
      .then(unfurls => client.chat.unfurl({ ts: event.message_ts, channel: event.channel, unfurls }))
      .catch(console.error);
});

(async () => {
  // Start the app
  await app.start(process.env.PORT || 3000);

  console.log('⚡️ Bolt app is running!');
})();
