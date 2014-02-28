var fs = require('fs'),
    async = require('async'),
    path = require('path'),
    watch = require('watch');

var grunt = null,
    done = null,
    startPath = null,
    foldersToWatch = null,
    buildTasks = null;

exports.init = function (gruntArg) {
    'use strict';

    // we tell grunt to handle things asynchronously
    done = this.async();
    // we save the grunt reference
    grunt = gruntArg;

    waitForChanges();
};

function waitForChanges() {
    var recursive = grunt.option('recursive'),
        processPath = process.cwd();

    startPath = grunt.option('start-path');
    if (startPath) {
        startPath = path.resolve(processPath, startPath);
    } else {
        startPath = processPath;
    }
    grunt.log.writeln('startPath: ' + startPath);

    buildTasks = determineBuildTasks();
    if (!buildTasks) {
        grunt.log.error('Could not find any build tasks!');
        return;
    }
    grunt.log.writeln(grunt.log.wordlist(buildTasks));

    foldersToWatch = determineFoldersToWatch();
    if (!foldersToWatch) {
        grunt.log.error('No folders to watch were specified!');
        return;
    }
    grunt.log.writeln(grunt.log.wordlist(foldersToWatch));

    startWatcher();
}

function determineBuildTasks() {
    var availableTasks = grunt.cli.tasks,
        buildTasks = [];

    for (var i=0; i<availableTasks.length; i++) {
        if (availableTasks[i].indexOf('build-') !== -1) {
            buildTasks.push(availableTasks[i]);
        }
    }

    return buildTasks.length == 0 ? null : buildTasks;
}

function determineFoldersToWatch() {
    return [ 'js', 'lang', 'assets', 'css' ];
}

function startWatcher() {
    watch.createMonitor(startPath, {
        ignoreDotFiles: true,
        filter: filterWatchedFiles
    }, function(monitor) {
        grunt.log.writeln('Waiting for a module to be modified...\n');

        ['created', 'changed', 'updated'].forEach(function (event) {
            monitor.on(event, handleFileChange);
        });
    });
}

function filterWatchedFiles(filePath) {
    var fileName = path.basename(filePath),
        baseFolder = path.dirname(filePath),
        shortPath = baseFolder.replace(startPath, '.'),
        validFolder;

    return true;

    if (fileName == 'build.json') {
        return true;
    }

    validFolder = foldersToWatch.some(function(folder) {
        console.log(filePath);
        return shortPath.indexOf(folder) !== -1;
    });

    return validFolder;
}

function handleFileChange(filePath, currentStats, previousStats) {
    var changedModulePath = findChangedModule(filePath);

    if (!changedModulePath) {
        return;
    }

    grunt.option('module-path', changedModulePath);

    grunt.util.spawn({
        grunt: true,
        opts: {
            cwd: process.cwd(),
            stdio: 'inherit'
        },
        args: grunt.option.flags().concat(buildTasks)
    }, function(err, res, code) {
        grunt.log.writeln('grunt spawn finished!');
    });
}

function findChangedModule(filePath) {
    var modulePath = filePath,
        buildJsonPath;

    do {
        modulePath = path.dirname(modulePath);
        buildJsonPath = path.join(modulePath, 'build.json');

        if (fs.existsSync(buildJsonPath)) {
            return modulePath;
        }
    } while(modulePath.length >= startPath.length);

    return null;
}

function debug(msg) {
    var isDebug = grunt.option('debug');

    if (isDebug) {
        grunt.verbose.writeln(msg);
    }
}