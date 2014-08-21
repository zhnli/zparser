#!/bin/sh

INSTALL=0
PRGMPATH=`pwd`
BUILDPATH=_build
CONVERTEDPATH=_build/converted
MINIFIEDPATH=_build/minified
UGLIFYPATH=/home/zhen/z_work/uglifyjs/UglifyJS
DEPLOYPATH=/usr/share/nginx/www/zparser
DEPLOYPATHJS=/usr/share/nginx/www/zparser/js
DEPLOYPATHCSS=/usr/share/nginx/www/zparser/css

minify_js () {
    $UGLIFYPATH/bin/uglifyjs -o $MINIFIEDPATH/zdiagram.min.js $CONVERTEDPATH/zdiagram.js
    $UGLIFYPATH/bin/uglifyjs -o $MINIFIEDPATH/zparser.min.js $CONVERTEDPATH/zparser.js
}

convert_basic () {
    python build/convertcode.py -f src/js/zparser.js -l BasicLevel -o $CONVERTEDPATH/zparser.js
    python build/convertcode.py -f src/js/zdiagram.js -l BasicLevel -o $CONVERTEDPATH/zdiagram.js
    python build/convertcode.py -f src/html/zparser.html -l BasicLevel -o $CONVERTEDPATH/zparser.html
}

convert_ext () {
    python build/convertcode.py -f src/js/zparser.js -l ExtLevel -o $CONVERTEDPATH/zparser.js
    python build/convertcode.py -f src/js/zdiagram.js -l ExtLevel -o $CONVERTEDPATH/zdiagram.js
    python build/convertcode.py -f src/html/zparser.html -l ExtLevel -o $CONVERTEDPATH/zparser.html
}

convert_dev () {
    python build/convertcode.py -f src/js/zparser.js -l ExtLevel -o $CONVERTEDPATH/zparser.js
    python build/convertcode.py -f src/js/zdiagram.js -l ExtLevel -o $CONVERTEDPATH/zdiagram.js
    python build/convertcode.py -f src/html/zparser.html -l ExtLevel -o $CONVERTEDPATH/zparser.html
    sed -e 's/zparser.min.js/zparser.js/g; s/zdiagram.min.js/zdiagram.js/g' $CONVERTEDPATH/zparser.html > $CONVERTEDPATH/zparser.html.converted
    mv $CONVERTEDPATH/zparser.html.converted $CONVERTEDPATH/zparser.html
}

install_depends () {
    [ ! -f $DEPLOYPATH/js/raphael-min.js ] && sudo cp depends/js/raphael-min.js $DEPLOYPATHJS
    [ ! -f $DEPLOYPATH/js/underscore-min.js ] && sudo cp depends/js/underscore-min.js $DEPLOYPATHJS
}

prepare () {
    if [ ! -d $CONVERTEDPATH ]; then
        mkdir -p $CONVERTEDPATH
    fi
    if [ ! -d $MINIFIEDPATH ]; then
        mkdir -p $MINIFIEDPATH
    fi
    if [ ! -d $DEPLOYPATH ]; then
        sudo mkdir -p $DEPLOYPATHJS
        sudo mkdir -p $DEPLOYPATHCSS
    fi
    install_depends
}

build_basic () {
    echo "Building basic ..."
    clean
    prepare
    convert_basic
    minify_js

    if [ ${INSTALL} -eq 1 ]; then
        echo "Installing basic ..."
        sudo cp $CONVERTEDPATH/zparser.html $DEPLOYPATH/index.html
        sudo cp $MINIFIEDPATH/zparser.min.js $DEPLOYPATHJS
        sudo cp $MINIFIEDPATH/zdiagram.min.js $DEPLOYPATHJS
    fi
}

build_ext () {
    echo "Building ext ..."
    clean
    prepare
    convert_ext
    minify_js

    if [ ${INSTALL} -eq 1 ]; then
        echo "Installing ext ..."
        sudo cp $CONVERTEDPATH/zparser.html $DEPLOYPATH/index.html
        sudo cp $MINIFIEDPATH/zparser.min.js $DEPLOYPATHJS
        sudo cp $MINIFIEDPATH/zdiagram.min.js $DEPLOYPATHJS
    fi
}

build_dev () {
    echo "Building dev ..."
    clean
    prepare
    convert_dev

    if [ ${INSTALL} -eq 1 ]; then
        echo "Installing dev ..."
        sudo cp $CONVERTEDPATH/zparser.html $DEPLOYPATH/index.html
        sudo cp $CONVERTEDPATH/zparser.js $DEPLOYPATHJS
        sudo cp $CONVERTEDPATH/zdiagram.js $DEPLOYPATHJS
    fi
}

clean () {
    echo "Cleaning ..."
    if [ -d ./_build ]; then
        rm -rf ./_build
    fi
}

cleandev () {
    echo "Cleaning dev ..."
    if [ -f $DEPLOYPATH/index.html ]; then
        sudo rm -f $DEPLOYPATH/index.html
    fi
    if [ -f $DEPLOYPATHJS/zparser.js ]; then
        sudo rm -f $DEPLOYPATHJS/zparser.js
    fi
    if [ -f $DEPLOYPATHJS/zdiagram.js ]; then
        sudo rm -f $DEPLOYPATHJS/zdiagram.js
    fi
}

showhelp () {
    echo "Usage: $0 [options]"
    echo ""
    echo "Options:"
    echo "-h, --help         Show this help message and exit."
    echo "-t, --target       Build target. {basic|ext|dev}"
    echo "--clean            Clean up."
    echo "--cleandev         Clean up dev."
    exit 1
}

if [ $# -eq 0 ]; then
    showhelp
    exit 1
fi

while [ $# -gt 0 ]
do
    KEY="$1"
    shift
    case $KEY in
    -h|--help)
        showhelp
        ;;
    -t|--target)
        TARGET="$1"
        shift
        ;;
    --install)
        INSTALL=1
        ;;
    --clean)
        clean
        ;;
    --cleandev)
        cleandev
        ;;
    *)
        showhelp
        exit 1
        ;;
    esac
done

if [ -z $TARGET ]; then
    exit 1
fi

case $TARGET in
basic)
    build_basic
    ;;
ext)
    build_ext
    ;;
dev)
    build_dev
    ;;
*)
    echo "Unrecognized target {basic|ext|dev}"
    exit 1
    ;;
esac

