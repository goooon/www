// Copyright 2018 The Outline Authors
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import {SIP002_URI} from 'ShadowsocksConfig/shadowsocks_config';
import * as url from 'url';

import {EventQueue} from '../model/events';

import {App} from './app';
import {onceEnvVars} from './environment';
import {PersistentServerFactory, PersistentServerRepository} from './persistent_server';
import {OutlinePlatform} from './platform';
import {Settings} from './settings';

type ServerConfig = cordova.plugins.outline.ServerConfig;

// Used to determine whether to use Polymer functionality on app initialization failure.
let webComponentsAreReady = false;
let testTimerCounter = 0;
const DEBUG_FLAG = false;
let expireddate = 0;
document.addEventListener('WebComponentsReady', () => {
  console.debug('received WebComponentsReady event');
  webComponentsAreReady = true;
});

// Used to delay loading the app until (translation) resources have been loaded. This can happen a
// little later than WebComponentsReady.
const oncePolymerIsReady = new Promise((resolve) => {
  document.addEventListener('app-localize-resources-loaded', () => {
    console.debug('received app-localize-resources-loaded event');
    resolve();
  });
});

// Helpers

// Do not call until WebComponentsReady has fired!
function getRootEl() {
  return (document.querySelector('app-root') as {}) as polymer.Base;
}

function createServerRepo(
    eventQueue: EventQueue, storage: Storage, deviceSupport: boolean,
    connectionType: PersistentServerFactory) {
  const repo = new PersistentServerRepository(connectionType, eventQueue, storage);
  if (!deviceSupport) {
    console.debug('Detected development environment, using fake servers.');
    if (repo.getAll().length === 0) {
      // repo.add({name: 'Fake Working Server', host: '127.0.0.1'});
      // repo.add({name: 'Fake Broken Server', host: '192.0.2.1'});
      // repo.add({name: 'Fake Unreachable Server', host: '10.0.0.24'});
    }
  }
  return repo;
}

// setCurrentSelectedServerIndex(0);
function setCurrentSelectedServerIndex(
    app: App, index: number, servers: any, cntArray: number[], product: any) {
  console.log("wang---setCurrentSelectedServerIndex---"+servers.length);
  console.log("wang---setCurrentSelectedServerIndex---"+JSON.stringify(servers));
  if (servers.length === index) {
    console.log('handleVPNService');
    handleVPNService(app, servers, cntArray, product);
    return;
  }
  console.log('setCurrentSelectedServerIndex:' + index);
  const server = servers[index];
  {
    const requestUrl = 'http://' + server['host'] + ':3000/v1/status/online';
    console.log(requestUrl);
    const request = new XMLHttpRequest();
    request.open('GET', requestUrl);
    request.timeout = 5000;
    request.ontimeout = function ontimerout() {
      console.log('setCurrentSelectedServerIndex time out');
      const userCount = 0x7FFFFFFF;
      cntArray.push(userCount);
      setCurrentSelectedServerIndex(app, index + 1, servers, cntArray, product);
    };
    request.onload = function onload() {
      if (request.status === 200) {
        console.log('setCurrentSelectedServerIndex succ：' + index);

      } else {
        console.log('setCurrentSelectedServerIndex failed:' + index);
      }
    };
    request.onerror = function onerror() {
      console.log('setCurrentSelectedServerIndex err');
      const userCount = 0x7FFFFFFF;
      cntArray.push(userCount);
      setCurrentSelectedServerIndex(app, index + 1, servers, cntArray, product);
    };
    request.onprogress = function onprogress(event: any) {
      console.log('setCurrentSelectedServerIndex progress');
    };
    request.onreadystatechange = function onreadystatechange() {
      console.log(
          'setCurrentSelectedServerIndex for list readyState:' + request.readyState +
          ' status:' + request.status);
      if (request.readyState === 4 && request.status === 200) {  //验证请求是否发送成功
        const json = JSON.parse(request.responseText);
        console.log(json);

        let userCount = 0;

        const msg = json['msg'];
        if (msg == null || msg === '') {
          userCount = 0x7FFFFFFF;
        } else {
          userCount = parseInt(msg, 10);
        }
        cntArray.push(userCount);
        setCurrentSelectedServerIndex(app, index + 1, servers, cntArray, product);
      }
    };
    request.send();
  }
}

function handleVPNService(app: App, servers: any, cntArray: number[], product: any) {
  let minUsers = cntArray[0];
  let currentSelectedServerIndex = 0;

  for (let i = 0; i < servers.length; ++i) {
    if (cntArray[i] < minUsers) {
      currentSelectedServerIndex = i;
      minUsers = cntArray[i];
    }
  }
  const server = servers[currentSelectedServerIndex];
  const config:ServerConfig = {
    host: server['host'],
    serverName:server['name'],
    port: product['port'],
    method: product['method'],
    password: product['password'],
    name: product['name'],
    expiredate:product['nextduedate'],
    accessKey: 'not used here'
  };
  console.log('use server index :' + currentSelectedServerIndex + ":" + JSON.stringify(config));
  const serverId = app.addServer(config);
  console.log("serverId is " + serverId);
  app.setCurrentId(serverId);
  app.syncState();
}

function lookupServer(app: App, product: any) {
  console.log('enter lookupServer');
  const servers = product['server'];
  if (servers == null || servers.length === 0) {
    return null;
  }
  // var cntArray: number[] = [];
  let cntArray = new Array<number>();
  console.log('lookupServer');
  setCurrentSelectedServerIndex(app, 0, servers, cntArray, product);
}

function loadServerList(app: App) {
  const request = new XMLHttpRequest();
  // "action=login&email="+document.getElementById("email").value+"&password="+document.getElementById("password").value;
  const uuid = window.localStorage['uuid'];
  const hash = window.localStorage['hash'];
  const url =
      window.localStorage["webroot"]+'api/index.php?action=getServerList&uuid=' + uuid + '&hash=' + hash;
  // const url = "http://hk9.56xiaomishu.com:3000/v1/status/online";
  console.log(url);
  request.open('GET', url);
  request.onload = function onload() {
    if (request.status === 200) {
      console.log('getServerList succ');
    } else {
      console.log('getServerList failed');
    }
  };
  request.onerror = function onerror() {
    console.log('getServerList err');
  };
  request.onprogress = function onprogress(event: any) {
    console.log('progress');
  };
  request.onreadystatechange = function onreadystatechange() {
    console.log(
        'onreadystatechange for list readyState:' + request.readyState +
        ' status:' + request.status);
    if (request.readyState === 4 && request.status === 200) {  //验证请求是否发送成功
      const json = JSON.parse(request.responseText);
      console.log(json);
      // status: "success", broadcast: "", qqGroupKey: "CilQ4jAqJ8e1NSv5PsSbyDhdb3I4F_x4", hash:
      // "$2y$10$guz8MPzEi8xZQDfcSNWhDufTiQc8QSOistgdoaaTEBuFW4MFr2J8a", product: Array(1)}
      if (json['status'] === 'success') {
        const products = json['product'];
        const broadcast = json['broadcast'];
        const qqgroup = json['qqGroupKey'];

        if(DEBUG_FLAG){
          testTimerCounter ++;
        }
        if ((products == null || products.length === 0) || (DEBUG_FLAG && testTimerCounter>= 2)) {
          if(app.isConnected()){
            app.disconnectCurrentServer();
          }
          app.setExpired(true);
          getRootEl().showToast('服务到期，请重新充值' + DEBUG_FLAG ? ' debug' : '', 120000);
          return;
        }
        else if(app.isConnected()){
          return;
        }
        app.setExpired(false);
        const product = products[products.length - 1];
        expireddate = product['nextduedate'];
        lookupServer(app, product);
      } else {
      }
    }
  };
  request.send();
}

export function main(platform: OutlinePlatform) {
  console.log('main');
  let ret = Promise.all([onceEnvVars, oncePolymerIsReady])
      .then(
          ([environmentVars]) => {

            console.debug('running main() function');
            console.log('running main.ts');
            const queryParams = url.parse(document.URL, true).query;
            const debugMode = queryParams.debug === 'true';

            const eventQueue = new EventQueue();
            const serverRepo = createServerRepo(
                eventQueue, window.localStorage, platform.hasDeviceSupport(),
                platform.getPersistentServerFactory());
            const settings = new Settings();
            const app = new App(
                eventQueue, serverRepo, getRootEl(), debugMode, platform.getUrlInterceptor(),
                platform.getClipboard(), platform.getErrorReporter(environmentVars), settings,
                environmentVars, platform.getUpdater(), platform.quitApplication);
            loadServerList(app);
            //todo gz timer, update the duration
            /*
            function fmtDate(obj:any){
              var date =  new Date(obj);
              var y = 1900+date.getYear();
              var m = "0"+(date.getMonth()+1);
              var d = "0"+date.getDate();
              return y+"-"+m.substring(m.length-2,m.length)+"-"+d.substring(d.length-2,d.length);
            }*/

            function timeOutCallback():void{
              var myDate = new Date();
              //var date = myDate.toLocaleDateString().replace(/\//g,"-");
              var currentdate = new Date(myDate.getFullYear() + '-' + (myDate.getMonth() + 1) + '-' + myDate.getDate());
              var expiredate = new Date(expireddate);

              if(currentdate > expiredate){
                if(app.isConnected()){
                  app.disconnectCurrentServer();
                }
                app.setExpired(true);
                //getRootEl().showToast('服务到期，请重新充值' + DEBUG_FLAG ? ' debug' : '', 120000);
              }
              /*
              if(app.isConnected()){
                console.log("handle timer for connected");
                loadServerList(app);
              }
              else{
                console.log("handle timer for disconnected");
              }*/
            }
            setInterval(timeOutCallback,DEBUG_FLAG ? 1000 * 1 : 1000 * 60 * 60 * 3);
          },
          (e) => {
            onUnexpectedError(e);
            throw e;
          });
      console.log("exit main");
      return ret;
}



function onUnexpectedError(error: Error) {
  const rootEl = getRootEl();
  if (webComponentsAreReady && rootEl && rootEl.localize) {
    const localize = rootEl.localize.bind(rootEl);
    rootEl.showToast(localize('error-unexpected'), 120000);
  } else {
    // Something went terribly wrong (i.e. Polymer failed to initialize). Provide some messaging to
    // the user, even if we are not able to display it in a toast or localize it.
    // TODO: provide an help email once we have a domain.
    alert(`An unexpected error occurred.`);
  }
  console.error(error);
}

// Returns Polymer's localization function. Must be called after WebComponentsReady has fired.
export function getLocalizationFunction() {
  const rootEl = getRootEl();
  if (!rootEl) {
    return null;
  }
  return rootEl.localize;
}
/*{
        "status": "success",
        "broadcast": "",
        "qqGroupKey": "CilQ4jAqJ8e1NSv5PsSbyDhdb3I4F_x4",
        "hash": "$2y$10$guz8MPzEi8xZQDfcSNWhDufTiQc8QSOistgdoaaTEBuFW4MFr2J8a",
        "product": [{
                "id": 3,
                "name": "年付套餐",
                "groupname": "p站加速器",
                "regdate": "2018-12-06",
                "nextduedate": "2018-12-06",
                "domainstatus": "Active",
                "port": "10086",
                "password": "WStxM1RzIzNMN1phdjE=",
                "obfs": "plain",
                "method": "aes-256-cfb",
                "protocol": "origin",
                "server": [{
                        "name": "香港九线 ",
                        "host": "hk9.56xiaomishu.com",
                        "desc": " 4K视频，阿里云机房",
                        "country": "hongkong\r"
                }, {
                        "name": "香港专线 ",
                        "host": "hkpro2.56xiaomishu.com",
                        "desc": " 4K视频，阿里云机房",
                        "country": "hongkong"
                }],
                "traffic": {
                        "kb": {
                                "use": 0,
                                "free": 52428800,
                                "up": 0,
                                "down": 0,
                                "total": 52428800
                        },
                        "mb": {
                                "use": 0,
                                "free": 51200,
                                "up": 0,
                                "down": 0,
                                "total": 51200
                        },
                        "gb": {
                                "use": 0,
                                "free": 50,
                                "up": 0,
                                "down": 0,
                                "total": 50
                        }
                }
        }]
}*/
/*
383309628@qq.com
wangandhao
*/