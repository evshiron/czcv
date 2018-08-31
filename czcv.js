
const vm = require('vm');

const request = require('request');
const striptags = require('striptags');

const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/68.0.3440.106 Safari/537.36';

async function pingWithServer(referer, key, json, server) {

  const ts = Date.now();
  const callback = `jQuery_${ts}`;
  const url = `http://m.tool.chinaz.com/iframe.ashx?t=ping&callback=${callback}`;

  const result = await new Promise((resolve, reject) => {
    request(url, {
      method: 'POST',
      headers: {
        'user-agent': USER_AGENT,
        'content-type': 'application/x-www-form-urlencoded',
        referer,
      },
      form: {
        host: json.host,
        ishost: json.ishost,
        checktype: json.checktype,
        encode: key,
        guid: server.guid,
      },
    }, (err, res, body) => {
      if (err) {
        return reject(err);
      }

      const sandbox = {
        [callback]: resolve,
      };
      vm.runInNewContext(body, sandbox);
    });
  });

  if (result.state === 0) {
    throw new Error('remote timeout');
  } else if (result.state === 1) {
    return {
      ip: result.result.ip,
      geoip: result.result.ipaddress,
      rttime: striptags(result.result.responsetime),
      rttl: striptags(result.result.ttl),
    };
  }

}

async function bulkPings(host, opts) {

  const options = Object.assign({}, {
    telecom: true,
    unicom: true,
    mobile: true,
    fusion: true,
    foreign: true,
    count: 5,
  }, opts);

  const linetypes = [];
  if (options.telecom) linetypes.push(encodeURIComponent('电信'));
  if (options.unicom) linetypes.push(encodeURIComponent('联通'));
  if (options.mobile) linetypes.push(encodeURIComponent('移动'));
  if (options.fusion) linetypes.push(encodeURIComponent('多线'));
  if (options.foreign) linetypes.push(encodeURIComponent('海外'));

  if (linetypes.length === 0) {
    return console.warn('falsy server filter');
  }

  const url = `http://m.tool.chinaz.com/ping?checktype=0&linetype=${linetypes.join(',')}`;

  const formBody = `host=${encodeURIComponent(host)}&checktype=0&${linetypes.map((t) => `linetype=${t}`).join('&')}`;

  const { key, json } = await new Promise((resolve, reject) => {
    request(url, {
      method: 'POST',
      headers: {
        'user-agent': USER_AGENT,
        'content-type': 'application/x-www-form-urlencoded',
        'referer': url,
      },
      body: formBody,
    }, (err, res, body) => {
      if (err) {
        return reject(err);
      }

      const enkey = body.match(/var enkey=(.+?);$/m)[0];
      const json = body.match(/var json=(.+?);$/m)[0];
      const sandbox = {};
      vm.runInNewContext(enkey, sandbox);
      vm.runInNewContext(json, sandbox);
      resolve({
        key: sandbox.enkey,
        json: sandbox.json,
      });
    });
  });

  for (let i = 0 ; i < Math.min(json.line.length, options.count); i++) {
    const server = json.line[i];
    pingWithServer(url, key, json, server)
      .then(console.info)
      .catch(console.error);
  }

}

const argv = require('yargs')
  .string('host')
  .boolean('telecom')
  .boolean('unicom')
  .boolean('mobile')
  .boolean('fusion')
  .boolean('foreign')
  .number('count')
  .demandOption([ 'host' ])
  .default({
    telecom: false,
    unicom: false,
    mobile: false,
    fusion: false,
    foreign: false,
  })
  .argv;

bulkPings(argv.host, {
  ...argv,
});
