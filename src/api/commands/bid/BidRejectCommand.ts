// Copyright (c) 2017-2019, The Particl Market developers
// Distributed under the GPL software license, see the accompanying
// file COPYING or https://github.com/particl/particl-market/blob/develop/LICENSE

import * as _ from 'lodash';
import { inject, named } from 'inversify';
import { validate, request } from '../../../core/api/Validate';
import { Logger as LoggerType } from '../../../core/Logger';
import { Types, Core, Targets } from '../../../constants';
import * as resources from 'resources';
import { RpcRequest } from '../../requests/RpcRequest';
import { RpcCommandInterface } from '../RpcCommandInterface';
import { ListingItemService } from '../../services/ListingItemService';
import { MessageException } from '../../exceptions/MessageException';
import { Commands} from '../CommandEnumType';
import { BaseCommand } from '../BaseCommand';
import { BidActionService } from '../../services/BidActionService';
import { SmsgSendResponse } from '../../responses/SmsgSendResponse';
import { BidService } from '../../services/BidService';
import { BidRejectReason } from '../../enums/BidRejectReason';
import { ModelNotFoundException } from '../../exceptions/ModelNotFoundException';
import { NotFoundException } from '../../exceptions/NotFoundException';
import { ImageDataProtocolType } from '../../enums/ImageDataProtocolType';
import { ImageDataEncodingType } from '../../enums/ImageDataEncodingType';

export class BidRejectCommand extends BaseCommand implements RpcCommandInterface<SmsgSendResponse> {

    public log: LoggerType;

    constructor(
        @inject(Types.Core) @named(Core.Logger) public Logger: typeof LoggerType,
        @inject(Types.Service) @named(Targets.Service.ListingItemService) private listingItemService: ListingItemService,
        @inject(Types.Service) @named(Targets.Service.BidService) private bidService: BidService,
        @inject(Types.Service) @named(Targets.Service.BidActionService) private bidActionService: BidActionService
    ) {
        super(Commands.BID_REJECT);
        this.log = new Logger(__filename);
    }

    /**
     * data.params[]:
     * [0]: bidId: number
     *
     * @param {RpcRequest} data
     * @returns {Promise<SmsgSendResponse>}
     */
    @validate()
    public async execute( @request(RpcRequest) data: RpcRequest): Promise<SmsgSendResponse> {

        const bidId = data.params[0];
        const reason = BidRejectReason[data.params[1]];
        const bid: resources.Bid = await this.bidService.findOne(bidId)
            .then(value => {
                return value.toJSON();
            });

        return this.bidActionService.reject(bid);
    }

    /**
     * data.params[]:
     * [0]: bidId
     * [1]: reasonId
     * @param {RpcRequest} data
     * @returns {Promise<RpcRequest>}
     */
    public async validate(data: RpcRequest): Promise<RpcRequest> {

        if (data.params.length < 1) {
            throw new MissingParamException('bidId');
        }

        if (typeof data.params[0] !== 'number') {
            throw new MessageException('bidId should be a number.');
        }

        if (data.params.length >= 2) {
            const reason = data.params[1];
            if (typeof reason !== 'string') {
                throw new InvalidParamException('reasonEnum', 'enum');
            } else if (!BidRejectReason[reason]) {
                throw new InvalidParamException('reasonEnum', 'enum');
            }
        }

        const bidId = data.params[0];
        let bid: any = await this.bidService.findOne(bidId);
        if (!bid) {
            throw new NotFoundException(bidId);
        }
        bid = bid.toJSON();

        // make sure ListingItem exists
        if (_.isEmpty(bid.ListingItem)) {
            throw new ModelNotFoundException('ListingItem');
        }

        // make sure we have a ListingItemTemplate, so we know it's our item
        if (_.isEmpty(bid.ListingItem.ListingItemTemplate)) {
            throw new ModelNotFoundException('ListingItemTemplate');
        }

        return data;
    }

    public usage(): string {
        return this.getName() + ' <bidId> <reasonId> ';
    }

    public help(): string {
        return this.usage() + ' -  ' + this.description() + '\n'
        // + '    <itemhash>               - String - The hash if the item whose bid we want to reject. '
        + '    <bidId>                  - Numeric - The ID of the bid we want to reject. '
        + '    <reasonId>               - [optional] Enum {OUT_OF_STOCK} - The predefined reason you want to specify for cancelling the bid. ';
    }

    public description(): string {
        return 'Reject bid.';
    }

    public example(): string {
        return 'bid ' + this.getName() + ' b90cee25-036b-4dca-8b17-0187ff325dbb OUT_OF_STOCK ';
    }
}
