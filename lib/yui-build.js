var fs = require('fs'),
    async = require('async'),
    path = require('path'),
    mkdirp = require('mkdirp'),
    ncp = require('ncp');

var SUB_REGEX = /@(\w*)@/gm,
    done = null,
    grunt = null;

exports.init = function (gruntArg) {
    'use strict';

    // we tell grunt to handle things asynchronously
    done = this.async();
    // we save the grunt reference
    grunt = gruntArg;

    findModules();
};

function findModules() {
    var startPath = grunt.option('start-path'),
        buildDir = grunt.option('build-dir'),
        recursive = grunt.option('recursive'),
        processPath = process.cwd();

    if (!buildDir) {
        grunt.log.error('Please specify the build-dir option!');
        return;
    }

    if (startPath) {
        startPath = path.resolve(processPath, startPath);
    } else {
        startPath = processPath;
    }

    grunt.log.writeln('buildDir: ' + buildDir);
    grunt.log.writeln('startPath: ' + startPath);

    if (recursive) {
        findRecursive(startPath, function(err, modules) {
            if (err) {
                return;
            }

            grunt.log.writeln('Found ' + modules.length + ' modules.');
            debug('Module paths: ' + grunt.log.wordlist(modules));

            buildAllModules(modules);
        });
    } else {
        findNormal(startPath);
    }
}

function findNormal(startPath) {
    fs.readdir(startPath, function(err, list) {
        async.filter(list, function (item, callback) {
            var buildFilePath = path.join(startPath, item, 'build.json');

            fs.exists(buildFilePath, function(exists) {
                callback(exists);
            });
        }, function(moduleNames) {
            var modulePaths = moduleNames.map(function(moduleName) {
                return path.join(startPath, moduleName);
            });

            grunt.log.writeln('Found ' + moduleNames.length + ' modules.');
            debug('Found modules: ' + grunt.log.wordlist(moduleNames));
            debug('Module paths: ' + grunt.log.wordlist(modulePaths));

            buildAllModules(modulePaths);
        });
    });
}

function findRecursive(startPath, recursiveCallback) {
    var results = [];

    fs.readdir(startPath, function(err, list) {
        if (err) {
            grunt.log.error('Error reading folder: ' + startPath);
            recursiveCallback(err, null);
            return;
        }

        async.each(list, function (item, eachCallback) {
            fs.stat(path.join(startPath, item), function(err, stats) {
                var folderPath = path.join(startPath, item),
                    buildFilePath = path.join(folderPath, 'build.json');

                if (err) {
                    return;
                }

                if (stats.isDirectory()) {
                    if (fs.existsSync(buildFilePath)) {
                        results.push(folderPath);
                        eachCallback();
                    } else {
                        findRecursive(folderPath, function(err, modules) {
                            if (modules) {
                                results = results.concat(modules);
                            }
                            eachCallback();
                        });
                    }
                } else {
                    eachCallback();
                }
            });

        }, function(err) {
            if (err) {
                recursiveCallback(err, null);
                return;
            }

            recursiveCallback(null, results);
        });
    });
}

function buildAllModules(modulePaths) {
    async.each(modulePaths, buildModule, function(err) {
        if (!err) {
            grunt.log.ok('All modules built successfully!');
        } else {
            grunt.log.error('Build failed!');
        }

        done();
    });
}

function buildModule(modulePath, callback) {
    var buildJsonPath = path.join(modulePath, 'build.json'),
        buildJson = grunt.file.readJSON(buildJsonPath), // read build.json
        builds = buildJson.builds,
        build;

    for (var buildName in builds) {
        if (builds.hasOwnProperty(buildName)) {
            build = builds[buildName];
            // save the build name, and the module path
            build['$moduleName'] = buildName;
            build['$modulePath'] = modulePath;

            performBuild(build);
        }
    }
    callback();
}

function performBuild(buildDefinition) {
    grunt.log.writeln('Building module: ' + buildDefinition['$moduleName']['green']);

    wrapJsFiles(buildDefinition, concatenateJsFiles(buildDefinition), determineRequires(buildDefinition));
    generateLanguageFiles(buildDefinition);
    copyAssets(buildDefinition);
    buildSkins(buildDefinition);
}

function wrapJsFiles(buildDefinition, content, requires) {
    var buildDir = grunt.option('build-dir'),
        templatePath = path.resolve(__dirname, '../templates/module.tpl'),
        templateContents = grunt.file.read(templatePath),
        moduleContents = substitute(templateContents, {
            MODULE_NAME : buildDefinition['$moduleName'],
            VERSION : '0.1',
            CONTENT : content,
            REQUIRES : requires
        }),
        moduleName = buildDefinition['$moduleName'],
        moduleOutputFolder = path.join(buildDir, moduleName),
        moduleFile = path.join(moduleOutputFolder, moduleName + '.js');

    mkdirp(moduleOutputFolder, function(err) {
        grunt.file.write(moduleFile, moduleContents);
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

function generateLanguageFiles(buildDefinition) {
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
        return;
    }

    languages = config['lang'];
    languages.push(''); // added the default language

    mkdirp(languageOutputFolder, function(err) {
        if (err) {
            grunt.log.error('Could not create the language output folder!');
            return;
        }

        languages.forEach(function(language) {
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
        });
    });
}

function copyAssets(buildDefinition) {
    var buildDir = grunt.option('build-dir'),
        moduleName = buildDefinition['$moduleName'],
        modulePath = buildDefinition['$modulePath'],
        assetsSource = path.join(modulePath, 'assets'),
        assetsDestination = path.join(buildDir, moduleName, 'assets');

    // first we make sure the assets folder exists
    if (!fs.existsSync(assetsSource)) {
        return;
    }

    ncp(assetsSource, assetsDestination, function(err) {
        if (err) {
            grunt.log.error('Failed to copy the "assets" folder!');
        } else {
            debug('Copied the assets folder.');
        }
    });
}

function buildSkins(buildDefinition) {
    var modulePath = buildDefinition['$modulePath'],
        skinsFolder = path.join(modulePath, 'assets', 'skins');

    // first we make sure the skins folder exists
    if (!fs.existsSync(skinsFolder)) {
        return;
    }

    debug('Found an assets/skins folder!');

    fs.readdir(skinsFolder, function(err, list) {
        if (err) {
            grunt.log.error('Failed to read the "skins" folder!');
        }

        list.forEach(function(item) {
            var itemPath = path.join(skinsFolder, item);

            fs.stat(itemPath, function(err, stats) {
                if (stats && stats.isDirectory()) {
                    buildSingleSkin(buildDefinition, item);
                }
            });
        });
    });
}

function buildSingleSkin(buildDefinition, skinName) {
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
                return;
            }

            grunt.file.write(skinDestinationFile, skinFileContents + coreCssFileContents);
        });
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