var fs = require('fs'),
    async = require('async'),
    path = require('path');

var done = null,
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
        findRecursive(startPath, buildModules);
    } else {
        findNormal(startPath, buildModules);
    }
}

function buildModules(err, modulePaths) {
    if (err) {
        return;
    }

    grunt.log.writeln('Found ' + modulePaths.length + ' modules.');
    debug('Module paths: ' + grunt.log.wordlist(modulePaths));

    grunt.option('module-list', modulePaths);

    done();
}

function findNormal(startPath, findCallback) {
    fs.readdir(startPath, function(err, list) {
        var modules = [];

        async.each(list, function (item, eachCallback) {
            var modulePath = path.join(startPath, item),
                buildFilePath = path.join(modulePath, 'build.json');

            if (fs.existsSync(buildFilePath)) {
                modules.push(modulePath);
            }
            eachCallback();
        }, function(err) {
            findCallback(err, modules);
        });
    });
}

function findRecursive(startPath, findCallback) {
    var results = [];

    fs.readdir(startPath, function(err, list) {
        if (err) {
            grunt.log.error('Error reading folder: ' + startPath);
            findCallback(err, null);
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
                findCallback(err, null);
                return;
            }

            findCallback(null, results);
        });
    });
}

function debug(msg) {
    var isDebug = grunt.option('debug');

    if (isDebug) {
        grunt.verbose.writeln(msg);
    }
}