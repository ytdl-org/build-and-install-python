// Action to build any Python version on the latest labels and install it into the local tool cache.
// Copyright (C) 2022 Matteo Dell'Acqua
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published
// by the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program.  If not, see <https://www.gnu.org/licenses/>.

import * as manifestTC from '@actions/tool-cache/lib/manifest';
import * as tc from '@actions/tool-cache';
import {BuildBehavior, PythonVersion} from '../inputs';
import {PyPyTest, SetupPythonTests, manifestUrl} from './version.fixtures';
import {SetupPythonResult, getSetupPythonResult, isPyPy} from '../version';
import {beforeAll, describe, expect, jest, test} from '@jest/globals';
import axios from 'axios';

jest.mock('@actions/core');
jest.mock('@actions/tool-cache');
jest.mock('@actions/tool-cache/lib/manifest');

const mockedTC = jest.mocked(tc);
const originalModule: typeof tc = jest.requireActual('@actions/tool-cache');
mockedTC.findFromManifest.mockImplementation(
  async (versionSpec, stable, manifest, archFilter) => {
    return originalModule.findFromManifest(
      versionSpec,
      stable,
      manifest,
      archFilter
    );
  }
);

const mockedManifestTC = jest.mocked(manifestTC);
const originalManifest: typeof manifestTC = jest.requireActual(
  '@actions/tool-cache/lib/manifest'
);
mockedManifestTC._getOsVersion.mockImplementation(() => {
  if (process.platform === 'linux') {
    return '22.04';
  } else {
    return originalManifest._getOsVersion();
  }
});
mockedManifestTC._findMatch.mockImplementation(
  async (versionSpec, stable, candidates, archFilter) => {
    return originalManifest._findMatch(
      versionSpec,
      stable,
      candidates,
      archFilter
    );
  }
);

describe('Is PyPy', () => {
  test.each(PyPyTest)(
    'returns $expectedPyPy with python version $pythonVersion.type-$pythonVersion.version',
    ({pythonVersion, expectedPyPy}) => {
      expect(isPyPy(pythonVersion)).toBe(expectedPyPy);
    }
  );
});

describe(`getSetupPythonResult with manifest url ${manifestUrl}`, () => {
  let manifest: tc.IToolRelease[];

  beforeAll(async () => {
    const response = await axios.get(manifestUrl);
    manifest = response.data;
    mockedTC.getManifestFromRepo.mockResolvedValue(manifest);
  });

  test('returns found version if present in local tool cache', async () => {
    mockedTC.find.mockReturnValue('/python/version/3.9.8/x64');
    const expected: SetupPythonResult = {
      success: true,
      version: '3.9.8'
    };

    const result = await getSetupPythonResult({
      architecture: process.arch,
      buildBehavior: BuildBehavior.Info,
      cache: false,
      token: 'token',
      version: new PythonVersion('3.9')
    });

    expect(result).toEqual(expected);
    expect(mockedTC.findFromManifest).not.toBeCalled();
    expect(mockedTC.getManifestFromRepo).not.toBeCalled();
  });

  test.each(SetupPythonTests)(
    `returns $expectedResult.${process.platform} for input version $inputs.version.type-$inputs.version.version and architecture $inputs.architecture`,
    async ({expectedResult, inputs}) => {
      mockedTC.find.mockReturnValue('');
      let platformResult: SetupPythonResult;
      if (process.platform === 'linux') {
        platformResult = expectedResult.linux;
      } else if (process.platform === 'darwin') {
        platformResult = expectedResult.darwin;
      } else if (process.platform === 'win32') {
        platformResult = expectedResult.win32;
      } else {
        throw new Error(`Action not supported on ${process.platform}`);
      }

      const result = await getSetupPythonResult(inputs);

      expect(result).toEqual(platformResult);
    }
  );
});
