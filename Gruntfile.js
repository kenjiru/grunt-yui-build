'use strict';

module.exports = function (grunt) {

    // Project configuration.
    grunt.initConfig({
        jshint: {
            all: [
                'Gruntfile.js',
                'tasks/*.js'
            ],
            options: {
                jshintrc: '.jshintrc'
            }
        },

        // Before generating any new files, remove any previously-created files.
        clean: {},

        // Configuration to be run (and then tested).
        "grunt-yui-build": {}

    });

    // Actually load this plugin's task(s).
    grunt.loadTasks('tasks');

    // Default task(s).
    grunt.registerTask('default', ['scan-modules']);
};
