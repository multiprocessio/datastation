gocovmerge coverage/gorunner*.cov > runner/all.out
cd runner
gocov convert all.out | gocov report | tee report
perc="$(tail report -n1 | cut -d ' ' -f 3 | cut -d '.' -f 1)"

# Bump up as needed
MINIMUM_COVERAGE="72"

if (( "$perc" < "$MINIMUM_COVERAGE" )); then
    echo "Code coverage ($perc) below minimum ($MINIMUM_COVERAGE)"
    exit 1
fi

echo "Code coverage is ok!"
