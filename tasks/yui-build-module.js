/*
 * grunt-yui-build-plugin
 * https://github.com/kenjiru/yui-build-plugin
 *
 * Copyright (c) 2014 kenjiru
 * Licensed under the MIT license.
 */

'use strict';

var yuiBuild = require('../lib/yui-build.js');

module.exports = function (grunt) {
    grunt.registerTask('yui-build-module', 'Builds a single YUI3 module.', function() {
        yuiBuild.init.call(this, grunt);
    });
};
