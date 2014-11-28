
'use strict';
var i18n_entries = [];
var PO = require('node-po-ext');
var stable = require("stable");

exports.name = 'xgettext2';
exports.usage = '<command> [options]';
exports.desc = 'xgettext2';

exports.register = function(commander) {
    commander
        .option('-f, --file <names>', 'output file', String, 'message')
        .option('-o, --optimize', 'Cleanup unnecessary words', Boolean, false)
        .action(function(opts){
            var options = arguments[arguments.length - 1];
            run(options);
        });
};

function run(options) {
    var root, conf, filename = 'fis-conf.js';
    i18n_entries = [];

    root = fis.util.realpath(process.cwd());
    if (!conf) {
        //try to find fis-conf.js
        var cwd = root,
            pos = cwd.length;
        do {
            cwd = cwd.substring(0, pos);
            conf = cwd + '/' + filename;
            if (fis.util.exists(conf)) {
                root = cwd;
                break;
            } else {
                conf = false;
                pos = cwd.lastIndexOf('/');
            }
        } while (pos > 0);
    }

    if (!conf) {
        return;
    }

    fis.project.setProjectRoot(root);
    //require 
    require(conf);

    var roadmapPath = fis.config.get('roadmap.path') || [];
    for (var i = 0; i < roadmapPath.length; i++) {
        if (roadmapPath[i].isJsLike || roadmapPath[i].isJsonLike) {
            delete roadmapPath[i].release;
        }
    }
    fis.config.set('roadmap.path', roadmapPath);

    var files = fis.project.getSource();
    var pofiles = [];

    fis.util.map(files, function(subpath, file) {
        if (file.ext == '.po') {
            pofiles.push(file);
        }

        if (file.ext == '.tmpl') {
            file.isJsLike = true;
        }

        if (file.isHtmlLike || file.isJsLike) {
            parse(file.getContent(), file);
        }
    });

    //console.log(pofiles);
    
    if (pofiles.length) {
        for (var i = 0; i < pofiles.length; i++) {
            var item = pofiles[i];
            write(item.realpath, item.getContent(), i18n_entries.slice(0), options);
        }
    } else {
        write(root + '/message.po', '', i18n_entries.slice(0), options);
    }

    console.log('ok!');
}

function write(path, content, i18n_entries, options){
    var po = PO.parse(content);
    var items = po.items;
    var res = {};
    var msgids = [];

    // 获取全部已有word
    for (var i = 0, len = items.length; i < len; i++) {
        var item = items[i], msgid = item.msgid;
        msgids.push(msgid);
    }

    // 输出 new word
    for (var i = 0, len = i18n_entries.length; i < len; i++) {
        var msgid = i18n_entries[i];
        if (msgids.indexOf(msgid) == -1) {
            console.log('new msgid "' + msgid + '"');
        }
    }

    // 
    for (var i = 0, len = items.length; i < len; i++) {
        var item = items[i], msgid = item.msgid;
        res[msgid] = item.msgstr[0];
        
        if (!options.optimize) {
            i18n_entries.push(msgid);
        }
        //msgids.push(msgid);
    }

    i18n_entries = unique(i18n_entries);
    stable(i18n_entries);

    var po_content = [
        'msgid ""',
        'msgstr ""',
        '"Plural-Forms: nplurals=1; plural=0;\\n"',
        '"Project-Id-Version: fis\\n"',
        '"POT-Creation-Date: \\n"',
        '"PO-Revision-Date: \\n"',
        '"Last-Translator: \\n"',
        '"Language-Team: \\n"',
        '"MIME-Version: 1.0\\n"',
        '"Content-Type: text/plain; charset=UTF-8\\n"',
        '"Content-Transfer-Encoding: 8bit\\n"',
        '"Language: zh_CN\\n"',
        '"X-Generator: fis xgettext2 \\n"',
        '"X-Poedit-SourceCharset: UTF-8\\n"',
        '', '', ''
    ].join('\n');

    for (var i = 0, len = i18n_entries.length; i < len; i++) {
        var entry = i18n_entries[i];
        po_content += 'msgid "' + entry.replace('"', '\"') + '"\n';
        po_content += 'msgstr "' + (res[entry] || '') + '"\n';
        po_content += '\n\n';
    }
    
    // console.log(path + ' ' + po_content);
    // return ;
    console.log('update file: ' + path);
    fis.util.write(path, po_content, 'utf-8');
}

function unique(arr) {
    var ret = [];
    var hash = {};

    for (var i = 0; i < arr.length; i++) {
        var item = arr[i];
        var key = typeof(item) + item;
        if (hash[key] !== 1) {
            ret.push(item);
            hash[key] = 1;
        }
    }

    return ret;
}

function parse(content, file) {
    var reg;

    if (file.isJsLike || file.isHtmlLike) {
        reg = /"(?:[^\\"\r\n\f]|\\[\s\S])*"|'(?:[^\\'\n\r\f]|\\[\s\S])*'|(\/\/[^\r\n\f]+|\/\*[\s\S]*?(?:\*\/|$))|\b(__)\(\s*("(?:[^\\"\r\n\f]|\\[\s\S])*"|'(?:[^\\'\n\r\f]|\\[\s\S])*')\s*\)/g;
        content.replace(reg, function(m, comment, type, value) {
            if (value) {
                var info = fis.util.stringQuote(value);
                i18n_entries.push(info.rest);
            }
            return m;
        });
    }
    
    if (file.isHtmlLike) {
        reg = /\s*("(?:[^\\"\r\n\f]|\\[\s\S])*"|'(?:[^\\'\n\r\f]|\\[\s\S])*')\s*\|\s*gettext/g
        content.replace(reg, function(m, value) {
            if (value) {
                var info = fis.util.stringQuote(value);
                i18n_entries.push(info.rest);
            }
            return m;
        });
    }
}
