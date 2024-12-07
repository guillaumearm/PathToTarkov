#!/bin/bash -e

DB_PATH=../../../SPT_Data/Server/database/
TARGET_PATH=external-resources/

ls $DB_PATH 2>&1 > /dev/null || exit 1

mkdir -p $TARGET_PATH
mkdir -p $TARGET_PATH/maps

## EN locales

cp $DB_PATH/locales/global/en.json $TARGET_PATH/locales_global_en.json

# Maps and extracts

cp $DB_PATH/locations/bigmap/base.json $TARGET_PATH/maps/customs.json
cp $DB_PATH/locations/bigmap/allExtracts.json $TARGET_PATH/maps/customs_allExtracts.json

cp $DB_PATH/locations/factory4_day/base.json $TARGET_PATH/maps/factory.json
cp $DB_PATH/locations/factory4_day/allExtracts.json $TARGET_PATH/maps/factory_allExtracts.json

cp $DB_PATH/locations/interchange/base.json $TARGET_PATH/maps/interchange.json
cp $DB_PATH/locations/interchange/allExtracts.json $TARGET_PATH/maps/interchange_allExtracts.json

cp $DB_PATH/locations/laboratory/base.json $TARGET_PATH/maps/laboratory.json
cp $DB_PATH/locations/laboratory/allExtracts.json $TARGET_PATH/maps/laboratory_allExtracts.json

cp $DB_PATH/locations/lighthouse/base.json $TARGET_PATH/maps/lighthouse.json
cp $DB_PATH/locations/lighthouse/allExtracts.json $TARGET_PATH/maps/lighthouse_allExtracts.json

cp $DB_PATH/locations/rezervbase/base.json $TARGET_PATH/maps/reserve.json
cp $DB_PATH/locations/rezervbase/allExtracts.json $TARGET_PATH/maps/reserve_allExtracts.json

cp $DB_PATH/locations/shoreline/base.json $TARGET_PATH/maps/shoreline.json
cp $DB_PATH/locations/shoreline/allExtracts.json $TARGET_PATH/maps/shoreline_allExtracts.json

cp $DB_PATH/locations/woods/base.json $TARGET_PATH/maps/woods.json
cp $DB_PATH/locations/woods/allExtracts.json $TARGET_PATH/maps/woods_allExtracts.json

cp $DB_PATH/locations/tarkovstreets/base.json $TARGET_PATH/maps/streets.json
cp $DB_PATH/locations/tarkovstreets/allExtracts.json $TARGET_PATH/maps/streets_allExtracts.json

cp $DB_PATH/locations/sandbox/base.json $TARGET_PATH/maps/groundzero.json
cp $DB_PATH/locations/sandbox/allExtracts.json $TARGET_PATH/maps/groundzero_allExtracts.json


