/**
 * Created by ximing on 2019-03-27.
 */
const { CompileStream } = require('gulp-typescript');
const { PassThrough } = require('stream');

/**
 * This is used to ensure that each project object is not busy when it is to be used
 * This prevents the annoying:
 * "Error: gulp-typescript: A project cannot be used in two compilations
 * at the same time. Create multiple projects with createProject instead."
 * @param project The project
 * @param reporter The reporter for the project
 * @returns {CompileStream} compiled project stream
 */
function tsCompileQStream(project, reporter) {
    return new class extends PassThrough {
        constructor() {
            super({ objectMode: true });
            this.js = this;
            this.dts = new PassThrough();
            this.transformStream = null;
            this.signal = () => {};
            this.on('pipe', this.checkExistingFlow);
        }

        checkExistingFlow(src) {
            this.removeListener('pipe', this.checkExistingFlow);
            src.unpipe(this);

            this.signal = CompileScheduler.scheduleCompilation(project, () => {
                this.transformStream = project(reporter).on('finish', () => this.signal());

                const compileStream = src.pipe(this.transformStream);
                compileStream.js.pipe(this.js);
                compileStream.dts.pipe(this.dts);
            });
        }
    }();
}

class CompileScheduler {
    constructor() {}
}
CompileScheduler.compileGateKeeper = new Map();

CompileScheduler.scheduleCompilation = function(project, beginCompilation) {
    let projectQueue = CompileScheduler.compileGateKeeper.get(project);
    if (!projectQueue) {
        projectQueue = [];
        CompileScheduler.compileGateKeeper.set(project, projectQueue);
    }
    const ret = CompileScheduler.startNext(project);
    if (projectQueue.length) {
        projectQueue.push(beginCompilation);
    } else {
        projectQueue.push(ret);
        beginCompilation();
    }
    return ret;
};

CompileScheduler.startNext = function(project) {
    return () => {
        const projectQueue = CompileScheduler.compileGateKeeper.get(project);
        if (projectQueue.length) {
            const nextCompilation = projectQueue.shift();
            nextCompilation();
        }
    };
};

module.exports = tsCompileQStream;
