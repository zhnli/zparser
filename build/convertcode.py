#!/usr/bin/env python

import sys
import signal
import argparse

def handle_sigterm( _signal, _frame ):
    """
    Signal handler.
    """
    # Make sure the program exit normally
    # The code in Finally block are executed
    sys.exit( 0 )

def main():
    try:
        signal.signal( signal.SIGTERM, handle_sigterm )

        parser = argparse.ArgumentParser()
        parser.add_argument( '-f', '--fname', type=str, dest="fname", required=True )
        parser.add_argument( '-l', '--level', type=str, dest="level", required=True )
        parser.add_argument( '-o', '--out', type=str, dest="out", default=sys.stdout )

        args = parser.parse_args()

        f_in = None
        f_out = None

        f_in = open(args.fname, 'rb')
        f_out = open(args.out, 'w')

        mark_js = '/*===IFDEF-'
        mark_start_js = '/*===IFDEF-%s===*/' % args.level
        mark_end_js = '/*===ENDIF===*/'

        mark_html = '<!--===IFDEF-'
        mark_start_html = '<!--===IFDEF-%s===-->' % args.level
        mark_end_html = '<!--===ENDIF===-->'

        do_write = 1
        for line in f_in:
            if mark_js in line or mark_html in line:
                if mark_start_js in line or mark_start_html in line:
                    continue
                else:
                    do_write = 0
            elif mark_end_js in line or mark_end_html in line:
                do_write = 1
                continue

            if do_write == 1:
                f_out.write(line)

    finally:
        if f_in:
            f_in.close()

        if f_out:
            f_out.close()

if __name__ == '__main__':
    main()
