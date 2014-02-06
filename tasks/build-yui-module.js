/*
 * grunt-yui-build
 * https://github.com/kenjiru/grunt-yui-build
 *
 * Copyright (c) 2014 kenjiru
 * Licensed under the MIT license.
 */

'use strict';

var scanModules = require('../lib/scan-modules.js'),
    buildYuiModule = require('../lib/build-yui-module.js');

module.exports = function (grunt) {
    grunt.registerTask('scan-modules', 'Scan for modules.', function() {
        scanModules.init.call(this, grunt);
    });

    grunt.registerTask('build-yui-module', 'Builds a single YUI3 module.', function() {
        buildYuiModule.init.call(this, grunt);
    });
};