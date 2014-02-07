var fs = require('fs'),
    async = require('async'),
    path = require('path'),
    mkdirp = require('mkdirp'),
    ncp = require('ncp').ncp;

var SUB_REGEX = /@(\w*)@/gm,
    done = null,
    grunt = null;

exports.init = function (gruntArg) {
    'use strict';

    // we tell grunt to handle things asynchronously
    done = this.async();
    // we save the grunt reference
    grunt = gruntArg;

    buildAllModules();
};

function buildAllModules() {
    var modulePath = grunt.option('module-path'),
        moduleList = grunt.option('module-list'),
        buildDir = grunt.option('build-dir'),
        processPath = process.cwd();

    if (!modulePath && !moduleList) {
        grunt.log.error('Please specify the "module-path" argument!');
        return;
    }

    if (!modulePath && !moduleList.length) {
        grunt.log.warn('No modules passed to the build task!');
        return;
    }

    if (!buildDir) {
        grunt.log.error('Please specify the "build-dir" argument!');
        return;
    }

    if (modulePath) {
        modulePath = path.resolve(processPath, modulePath);
    } else {
        modulePath = processPath;
    }

    debug('buildDir: ' + buildDir);
    debug('modulePath: ' + modulePath);
    debug('Modules to build: ' + grunt.log.wordlist(moduleList));

    if (!moduleList) {
        moduleList = [];
        moduleList.push(modulePath);
    }

    async.each(moduleList, function(module, eachCallback) {
        buildSingleModule(module, eachCallback);
    }, done);
}

function buildSingleModule(modulePath, callback) {
    // read build.json
    var buildJsonPath = path.join(modulePath, 'build.json'),
        buildJson = grunt.file.readJSON(buildJsonPath),
        builds = buildJson.builds,
        buildsArr = [],
        build;

    // get an array from the object
    for (var buildName in builds) {
        if (builds.hasOwnProperty(buildName)) {
            build = builds[buildName];
            // save the build name, and the module path
            build['$moduleName'] = buildName;
            build['$modulePath'] = modulePath;

            buildsArr.push(build);
        }
    }

    async.each(buildsArr, performBuild, callback);
}

function performBuild(buildDefinition, callback) {
    grunt.log.writeln('Building YUI module: ' + buildDefinition['$moduleName']['green']);

    async.parallel([
        async.apply(wrapJsFiles, buildDefinition),
        async.apply(generateLanguageFiles, buildDefinition),
        async.apply(copyAssets, buildDefinition),
        async.apply(buildSkins, buildDefinition)
    ], callback);
}

function wrapJsFiles(buildDefinition, callback) {
    var buildDir = grunt.option('build-dir'),
        templatePath = path.resolve(__dirname, '../templates/module.tpl'),
        templateContents = grunt.file.read(templatePath),
        moduleContents = substitute(templateContents, {
            MODULE_NAME : buildDefinition['$moduleName'],
            VERSION : '0.1',
            CONTENT : concatenateJsFiles(buildDefinition),
            REQUIRES : determineRequires(buildDefinition)
        }),
        moduleName = buildDefinition['$moduleName'],
        moduleOutputFolder = path.join(buildDir, moduleName),
        moduleFile = path.join(moduleOutputFolder, moduleName + '.js');

    mkdirp(moduleOutputFolder, function(err) {
        if (err) {
            grunt.log.error('Could not create the module output folder!');
        } else {
            grunt.file.write(moduleFile, moduleContents);
        }
        callback();
    });
}

function concatenateJsFiles(buildDefinition) {
    var modulePath = buildDefinition['$modulePath'],
        jsFiles = buildDefinition['jsfiles'],
        jsFilePaths = jsFiles.map(function(fileName) {
            return path.join(modulePath, 'js', fileName);
        }),
        result = '';

    debug(jsFilePaths);

    jsFilePaths.forEach(function(jsFilePath) {
        result += grunt.file.read(jsFilePath) + '\n';
    });

    return result;
}

function determineRequires(buildDefinition) {
    var requiresArr = null,
        requiresStr = '';

    if (buildDefinition['config']) {
        requiresArr = buildDefinition['config']['requires'];

        if (requiresArr) {
            requiresStr = requiresArr.map(function(item) {
                return '"' + item + '"';
            }).join(',');
        }
    }

    debug('Requires: ' + requiresStr);

    return requiresStr;
}

function generateLanguageFiles(buildDefinition, callback) {
    var buildDir = grunt.option('build-dir'),
        templatePath = path.resolve(__dirname, '../templates/language.tpl'),
        templateContents = grunt.file.read(templatePath),
        config = buildDefinition['config'],
        languages,
        moduleName = buildDefinition['$moduleName'],
        modulePath = buildDefinition['$modulePath'],
        languageOutputFolder = path.join(buildDir, moduleName, 'lang');

    if (!config || !config['lang']) {
        debug('No language configured!');
        callback();
        return;
    }

    languages = config['lang'];
    languages.push(''); // added the default language

    mkdirp.sync(languageOutputFolder);

    async.each(languages, function(language, eachCallback) {
        var languageModule = language ? moduleName + '_' + language : moduleName,
            languageFilePath = path.join(modulePath, 'lang', languageModule + '.js'),
            stringsContent = grunt.file.read(languageFilePath),
            languageFileContents = substitute(templateContents, {
                LANG_MODULE : 'lang/' + languageModule,
                MODULE_NAME : moduleName,
                VERSION : '0.1',
                LANG : language,
                STRINGS : stringsContent
            }),
            languageFileOutput = path.join(languageOutputFolder, languageModule + '.js');

        grunt.file.write(languageFileOutput, languageFileContents);
        eachCallback();
    }, callback);
}

function copyAssets(buildDefinition, callback) {
    var buildDir = grunt.option('build-dir'),
        moduleName = buildDefinition['$moduleName'],
        modulePath = buildDefinition['$modulePath'],
        assetsSource = path.join(modulePath, 'assets'),
        assetsDestination = path.join(buildDir, moduleName, 'assets');

    if (!fs.existsSync(assetsSource)) {
        callback();
        return;
    }

    mkdirp.sync(assetsDestination);
    ncp(assetsSource, assetsDestination, function(err) {
        if (err) {
            grunt.log.error('Failed to copy the "assets" folder!');
        }
        callback();
    });
}

function buildSkins(buildDefinition, callback) {
    var modulePath = buildDefinition['$modulePath'],
        skinsFolder = path.join(modulePath, 'assets', 'skins');

    // first we make sure the skins folder exists
    if (!fs.existsSync(skinsFolder)) {
        callback();
        return;
    }

    debug('Found an assets/skins folder!');

    fs.readdir(skinsFolder, function(err, list) {
        if (err) {
            grunt.log.error('Failed to read the "skins" folder!');
            callback();
            return;
        }

        if (list) {
            async.each(list, function(item, eachCallback) {
                var itemPath = path.join(skinsFolder, item);

                fs.stat(itemPath, function(err, stats) {
                    if (stats && stats.isDirectory()) {
                        buildSingleSkin(buildDefinition, item, eachCallback);
                    }
                });
            }, callback);
        } else {
            callback();
        }
    });
}

function buildSingleSkin(buildDefinition, skinName, callback) {
    var buildDir = grunt.option('build-dir'),
        moduleName = buildDefinition['$moduleName'],
        modulePath = buildDefinition['$modulePath'],
        skinFile = path.join(modulePath, 'assets', 'skins', skinName, moduleName + '-skin.css'),
        skinDestinationFolder = path.join(buildDir, moduleName, 'assets', 'skins', skinName),
        skinDestinationFile = path.join(skinDestinationFolder, moduleName + '.css'),
        coreCssFile = path.join(modulePath, 'assets', moduleName + '-core.css'),
        skinFileContents = '',
        coreCssFileContents = '';

    grunt.verbose.writeln('Building skin ' + skinName);

    if (fs.existsSync(coreCssFile)) {
        coreCssFileContents = grunt.file.read(coreCssFile);
    }

    if (fs.existsSync(skinFile)) {
        skinFileContents = grunt.file.read(skinFile);
    }

    if (skinFileContents || coreCssFileContents) {
        mkdirp(skinDestinationFolder, function(err) {
            if (err) {
                grunt.log.error('Could not create the skins output folder!');
                callback();
                return;
            }

            grunt.file.write(skinDestinationFile, skinFileContents + coreCssFileContents);
            callback();
        });
    } else {
        callback();
    }
}

function debug(msg) {
    var isDebug = grunt.option('debug');

    if (isDebug) {
        grunt.verbose.writeln(msg);
    }
}

/**
 * Simple template method similar to YUI 3 Y.Lang.sub.
 * @param template A string representing the template.
 * @param obj The object with key values.
 * @returns {string|void}
 */
function substitute(template, obj) {
    return template.replace(SUB_REGEX, function (match, key) {
        return !obj[key] ? '' : obj[key];
    });
}