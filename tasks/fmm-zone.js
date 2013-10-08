
module.exports = function(grunt) {

  var easyimage = require('easyimage'),
      path      = require('path'),
      nodeatf   = require('node-atf');

  return grunt.registerMultiTask('fmm-zone', 'Make Fort McMoney zones assets.', function() {

    var TYPE_PANORAMA   = 'panorama',
        TYPE_ZOOM       = 'zoom',
        TYPE_THUMBNAIL  = 'thumbnail',
        FORMAT_DESKTOP  = 'desktop',
        FORMAT_IOS      = 'ios';

        done      = this.async(),
        options   = this.options({
          src: null,
          output: null,
          retina: false,
          atf: null
        });


    // utility methods
    var getImageSize = function( filepath, callback ){
          easyimage.info( filepath, function( error, stdout, stderror ){
            callback( stdout );
          });
        },
        resizeImage = function( filepath, dest, width, height, callback ){

          var o = { src: filepath, dst: dest };

          if( width > 0 ) o.width = width;
          if( height > 0 ) o.height = height;

          easyimage.resize( o, function( error, image, stderr ){
            if( error ) grunt.fail.warn( filepath + ' : ' + error  + ' :: ' + stderr );
            callback( dest );
          });
        },
        copyImage = function( filepath, dest, callback ){
          grunt.file.copy( filepath, dest );
          callback( dest );
        },
        cropImage = function( filepath, dest, width, height, x, y, gravity, callback ){

          var commands = []
              commands.push('convert ' + filepath);
              commands.push('-gravity ' + gravity );
              commands.push('-crop ' + width + 'x' + height + '+' + x + '+' + y + '\! -background transparent -flatten ' + dest);

          easyimage.exec(commands.join(' '), function(error, stdout, stderr){
            if( error ) grunt.fail.warn( error );
            callback( dest );
          });
        },
        atf = function( filepath, dest, callback ){

          var commands = [];

          if( options.atf == FORMAT_DESKTOP )
          {
            commands.push('-c d');
            commands.push('-r');
          }
          else if( options.atf == FORMAT_IOS )
          {
            commands.push('-c p');
            commands.push('-r');
            commands.push('-e');
          }
          else
          {
            commands.push('-c');
            commands.push('-r');
            commands.push('-e');
          };

          nodeatf.png2atf( filepath, dest, commands.join(' '), function(error, stdout, stderr){

            if( error ) grunt.fail.warn('Error during texture\'s encoding at: ' + filepath);
            callback( dest );
          });
        },
        clean = function( dir, callback ){ grunt.file.delete( dir ); callback() };



    // log options
    grunt.verbose.writeflags(options, 'Options');

    // create output directory
    if( !grunt.file.isDir( options.output ) ) grunt.file.mkdir( options.output );

    // create temporary directy in src folder
    grunt.file.mkdir( options.src + 'tmp/' );

    var tmp     = path.resolve( options.src + 'tmp/' ),
        output  = path.resolve( options.output );



    // create a new files array because grunt's one really sucks!!!
    var files = [];
    this.data.files.forEach(function( file ){ files.push({src: file.src, type: file.type}); });




    // process each files
    grunt.util.async.forEachSeries(files, function( file, next ){

      var filepath  = path.resolve( options.src + file.src ),
          extension = path.extname( file.src ),
          filename  = path.basename( file.src, extension );

      // check if file exists
      if( !grunt.file.exists( filepath ) )
      {
        grunt.fail.warn('File (' + options.src + file.src + ') doesn\'t exists.');
        next();
      };


      // if is panorama
      if( file.type == TYPE_PANORAMA )
      {
        grunt.log.writeln('Generating panorama: ' + file.src);

        // get image size
        getImageSize( filepath, function( info ){

          var width   = options.retina === true ? info.width : info.width * 0.5,
              height  = options.retina === true ? info.height : info.height * 0.5,
              slice   = options.retina === true ? 2048 : 1024,
              i       = 0,
              n       = Math.ceil( width / slice );

              resizeCallback = function( resized_filepath ){

                var slice_name = filename + '-' + ( i + 1 );

                grunt.log.writeln('Creating slice ' + ( i + 1 ) + ' of ' + n);

                // crop each slice and save cropped files
                cropImage( resized_filepath, tmp + '/' + slice_name + extension, slice, slice, i * slice, 0, 'NorthWest', function( crop_filepath ){

                  // run ATF compression on slice and save to output directory
                  atf( crop_filepath, output + '/' + slice_name + ( options.retina == true ? '@2x' : '' ) + '.atf', function( atf_filepath ){

                    // increase slice
                    i++;

                    if( i === n ) next(); // continue task
                    else resizeCallback( resized_filepath ); // perform next slice cropping
                  });
                });
              };

          // resize (if not retina) and save file
          if( options.retina === false ) resizeImage( filepath, tmp + '/' + file.src, width, height, resizeCallback );
          else copyImage( filepath, tmp + '/' + file.src, resizeCallback );

        });
      }
      // if is zoom
      else if( file.type === TYPE_ZOOM )
      {
        grunt.log.writeln('Generating zoom: ' + file.src);

        // get image size
        getImageSize( filepath, function( info ){

          var width   = options.retina === true ? info.width : info.width * 0.5,
              height  = options.retina === true ? info.height : info.height * 0.5,
              slice   = options.retina === true ? 2048 : 1024,
              i       = 0,
              n       = 0;

              resizeCallback = function( resized_filepath ){

                if( options.atf == FORMAT_DESKTOP )
                {
                  var slice_name = filename + '-' + ( i + 1 );
                  grunt.log.writeln('Creating slice ' + ( i + 1 ) + ' of ' + n);

                  // crop each slice and save cropped files
                  cropImage( resized_filepath, tmp + '/' + slice_name + extension, slice, slice, i * slice, 0, 'NorthWest', function( crop_filepath ){

                    // run ATF compression on slice and save to output directory
                    atf( crop_filepath, output + '/' + slice_name + ( options.retina == true ? '@2x' : '' ) + '.atf', function( atf_filepath ){

                      // increase slice
                      i++;

                      if( i === n ) next(); // continue task
                      else resizeCallback( resized_filepath ); // perform next slice cropping
                    });
                  });
                }
                else if( options.atf == FORMAT_IOS )
                {
                  cropImage( resized_filepath, tmp + '/' + filename + extension, slice, slice, 0, 0, 'North', function( crop_filepath ){

                    // run ATF compression on slice and save to output directory
                    atf( crop_filepath, output + '/' + filename + ( options.retina == true ? '@2x' : '' ) + '.atf', function( atf_filepath ){
                      next();
                    });

                  });
                }
                else next();

              };

          if( options.atf == FORMAT_DESKTOP )
          {
            n = Math.ceil( width / slice );

            // resize (if not retina) and save file
            if( options.retina === false ) resizeImage( filepath, tmp + '/' + file.src, width, height, resizeCallback );
            else copyImage( filepath, tmp + '/' + file.src, resizeCallback );
          }
          else if( options.atf == FORMAT_IOS )
          {
            width   = Math.ceil(width * 0.75);
            height  = Math.ceil(height * 0.75);

            // resize and save file
            resizeImage( filepath, tmp + '/' + file.src, width, height, resizeCallback );
          };

        });
      }
      else if( file.type === TYPE_THUMBNAIL )
      {
        grunt.log.writeln('Generating thumbnail: ' + file.src);

        // get image size
        getImageSize( filepath, function( info ){

          var width   = options.retina === true ? info.width : info.width * 0.5,
              height  = options.retina === true ? info.height : info.height * 0.5;

          // resize (if not retina) and save file
          if( options.retina === false ) resizeImage( filepath, output + '/' + file.src, width, height, function(){ next(); } );
          else copyImage( filepath, output + '/' + filename + '@2x' + extension, function(){ next(); } );

        });
      }
      else
      {
        grunt.fail.warn('Invalid type for file: ' + file.src);
        next();
      };

    }, function(){ clean( tmp, done ); });

  });

};
