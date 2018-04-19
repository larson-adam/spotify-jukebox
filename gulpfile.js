var gulp = require('gulp')
var csso = require('gulp-csso')


gulp.task('csso', function(){
    gulp.src('./public/css/pre/bootstrap4-hello-world.css')
        .pipe(csso())
        .pipe(gulp.dest('./public/css'));
});