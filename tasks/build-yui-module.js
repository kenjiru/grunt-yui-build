/*
 * grunt-yui-build
 * https://github.com/kenjiru/grunt-yui-build
 *
 * Copyright (c) 2014 kenjiru
 * Licensed under the MIT license.
 */

'use strict';

var walk = require('../lib/walk.js'),
    watch = require('../lib/watch.js'),
    buildYuiModule = require('../lib/build-yui-module.js');

module.exports = function (grunt) {
    grunt.registerTask('walk', 'Scan for modules.', function() {
        walk.init.call(this, grunt);
    });

    grunt.registerTask('watch', 'Wais for modules to change and then builds them.', function() {
        watch.init.call(this, grunt);
    });

    grunt.registerTask('build-yui-modules', 'Builds a single YUI3 module.', function() {
        buildYuiModule.init.call(this, grunt);
    });
};