import * as childProcess from 'child_process';
import * as fs from 'fs-extra';
import * as path from 'path';

export const NODE_LAMBDA_SRC_DIR = path.join(process.cwd(), '/dist/src');
export const NODE_LAMBDA_LAYER_DIR = path.join(process.cwd(), '/dist/layer');
export const NODE_LAMBDA_LAYER_RUNTIME_DIR_NAME = `nodejs`;

const getModulesInstallDirName = (): string => {
    return path.join(NODE_LAMBDA_LAYER_DIR, NODE_LAMBDA_LAYER_RUNTIME_DIR_NAME);
};

const copyPackageJson = (): void => {
    // copy package.json and package.lock.json
    fs.mkdirsSync(getModulesInstallDirName());
    ['package.json', 'package-lock.json'].map(file =>
        fs.copyFileSync(
            `${process.cwd()}/${file}`,
            `${getModulesInstallDirName()}/${file}`,
        ),
    );
};

/**
 * npm スクリプトでもやれなくはないが、change directory が npm スクリプト だとつらいため、
 * node_modules の bundle だけは node でやったほうが良いという結論です。
 */
export const bundleNpm = (): void => {
    // create bundle directory
    copyPackageJson();

    // install package.json (production)
    childProcess.execSync(
        `npm --prefix ${getModulesInstallDirName()} install --production`,
        {
            stdio: ['ignore', 'inherit', 'inherit'],
            env: { ...process.env },
            shell: 'bash',
        },
    );

    const rm = require('removeNPMAbsolutePaths');
    rm(getModulesInstallDirName(), { force: true, fields: ['_where', '_args'] })
        .then((results: any) =>
            results.forEach((result: any) => {
                // Print only information about files that couldn't be processed
                if (!result.success) {
                    console.log(result.err.message);
                }
            }),
        )
        .catch((err: any) => console.log(err.message));
};
