(function (request, Joi, Q, util, logger) {
    'use strict';

    var optionsValidation = Joi.object({
            endpoint: Joi.string().min(1).optional().example('https://codacy.com/coverage/:token/:commitId')
        }),
        tokenValidation = Joi.string().required().min(1).example('1234567890'),//TODO: Revisit this validation to see if we can better validate the values
        commitIdValidation = Joi.string().required().min(1).example('1234567890'), //TODO: Revisit this validation to see if we can better validate the values
        coverageDataValidation = Joi.object({
            total: Joi.number().integer().required().min(0).max(100),
            fileReports: Joi.array().required().includes(Joi.object({
                filename: Joi.string().required().min(1),
                total: Joi.number().integer().required().min(0).max(100),
                coverage: Joi.object().pattern(/\d/, Joi.number().integer().min(1))
            }).optional())
        }).example({total: 50, fileReports: [{filename: 'filename', total: 10, coverage: {1: 1, 2: 3}}]});

    module.exports = function (options) {
        var optionsValid = Joi.validate(optionsValidation, options, {
            stripUnknown: true
        });

        if (optionsValid.error) {
            logger.error(optionsValid.error);
            throw optionsValid.error;
        }

        var endpoint = options.endpoint || 'https://codacy.com/coverage/:token/:commitId';
        logger.debug('Setting up reporter communicating to: ' + endpoint);

        return {
            sendCoverage: function sendCoverage(token, commitId, data) {
                var deferred = Q.defer();

                process.nextTick(function () {
                    var tokenValid = Joi.validate(token, tokenValidation),
                        commitIdValid = Joi.validate(commitId, commitIdValidation),
                        dataValid = Joi.validate(data, coverageDataValidation, {
                            stripUnknown: true
                        }),
                        validationErr = tokenValid.error || commitIdValid.error || dataValid.error;

                    if (validationErr) {
                        logger.error(validationErr);
                        deferred.reject(validationErr);
                    }

                    return request({
                        url: endpoint.replace(':token', token).replace(':commitId', commitId),
                        method: 'POST',
                        json: data,
                        resolveWithFullResponse: true
                    }).then(function (res) {
                        if (res.statusCode !== 200) {
                            var err = new Error(util.format('Expected Status Code of 200, but got [%s]', res.statusCode));
                            err.response = res;
                            err.body = res.body;
                            logger.error(res);
                            return deferred.reject(err);
                        }
                        logger.debug('Successfully sent coverage data');
                        deferred.resolve();
                    }, function (res) {
                        var err = new Error(util.format('Expected Successful Status Code, but got [%s]', res.statusCode));
                        err.response = res;
                        err.body = res.body;
                        logger.error(res);
                        deferred.reject(err);
                    });
                });
                return deferred.promise;
            }
        };
    };
}(require('request-promise'), require('joi'), require('q'), require('util'), require('log-driver').logger));