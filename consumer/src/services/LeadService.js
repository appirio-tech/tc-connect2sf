/**
 * Represents the Rest API service for leads
 */

import Joi from 'joi';
import {logAndValidate} from '../common/decorators';

const postLeadSchema = Joi.object().keys({
  reqBody: Joi.object().keys({
    firstName: Joi.string().required(),
    lastName: Joi.string().required(),
    businessEmail: Joi.string().email().required(),
    title: Joi.string().required(),
    companyName: Joi.string().required(),
    companySize: Joi.string().required(),
    userName: Joi.string().required(),
  }),
}).required();

class LeadService {

  /**
   * Post the lead info to Salesforce
   * @param {Object} reqBody Request body
   * @returns {Object} sample response
   */
  @logAndValidate(['reqBody'], postLeadSchema)
  postLead(reqBody) { // eslint-disable-line no-unused-vars
    // TODO -- Replace with actual functions later
    return {success: true};
  }

}

export default new LeadService();
