import { RequestHandler } from 'express';
import e = require('express');
import got from 'got';
import { NPMPackage } from './types';

/**
 * Attempts to retrieve package data from the npm registry and return it
 */
let cachePkg = new Map();
export const getPackage: RequestHandler = async function (req, res, next) {
  const { name, version } = req.params;
  let dependenciesArr = [];
  let parent = name + ' ' + version;
  let dependencies: void | { [packageName: string]: string; } | PromiseLike<void>;
  let packagesArr = [{id: parent, label: parent}];

  try {
    res.setHeader('Access-Control-Allow-Origin', '*');

    const npmPackage = await getNpmPackage(name) as NPMPackage;
    if(npmPackage === undefined) return res.status(200).write("dependencies were not found");

    dependencies = npmPackage.versions[version]?.dependencies;
    await setDependencies(dependencies, parent, dependenciesArr, packagesArr);

    let uniquePkgs = GetUniquePackages(packagesArr);

    return res.status(200).json({name, version, dependenciesArr, packagesArr: uniquePkgs });

  } catch (error) {
    return next(error);
  }

};

const setDependencies = async function (dependencies, parent, dependenciesArr, packagesArr) {
  try {

    if (dependencies) {
      Object.keys(dependencies).forEach(x => dependenciesArr.push({ source: parent, target: makeLabel(x, dependencies) }));
      Object.keys(dependencies).forEach(x => packagesArr.push({ id: makeLabel(x, dependencies), label: makeLabel(x, dependencies) }));

      await Promise.all(Object.keys(dependencies).map(async x =>
        await addDependencies(x, dependencies[x].replace('^', '').replace('~', ''), dependenciesArr, packagesArr)));
    }
  }
  catch (error) {
    console.error(error);
  }
}

const makeLabel = function(x, dependencies) {
  return x.concat(' ', dependencies[x]).replace('^', '').replace('~', '');
}

const addDependencies = async function (name: string, version: string, dependenciesArr, packagesArr) {
  try {
    let parent = name + ' ' + version;
    let dependencies: { [packageName: string]: string; } | undefined;

    if (cachePkg.has(parent)) {
      dependencies = cachePkg.get(parent);
    }
    else {
      const npmPackage = await getNpmPackage(name) as NPMPackage;
      dependencies = npmPackage.versions[version]?.dependencies;
      cachePkg.set(parent, dependencies);
    }
    await setDependencies(dependencies, parent, dependenciesArr, packagesArr);
  }
  catch (error) {
    console.error(error);
  }
}

const getNpmPackage = async function (name: string){
  try {
    return await got(
      `https://registry.npmjs.org/${name}`,
    ).json();
  }
  catch (error) {
    console.error(error);
  }
}

function GetUniquePackages(packagesArr) {
  let uniqueObjectsArray: any = [];
  let uniqueObjectsSet = new Set();
  // Then loop through the objects array using for...of:
  for (const object of packagesArr) {
    // Create a string primitive in JSON-format
    const objectJSON = JSON.stringify(object);
    if (!uniqueObjectsSet.has(objectJSON)) {
      // We only add an object to the array one time
      uniqueObjectsArray.push(object);
    }
    // A Set will only ever add one copy of each string:
    uniqueObjectsSet.add(objectJSON);
  }
  return uniqueObjectsArray;
}