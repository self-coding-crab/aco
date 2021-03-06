import './DepositModal.css'
import React, { Component } from 'react'
import { withRouter } from 'react-router-dom'
import PropTypes from 'prop-types'
import Modal from 'react-bootstrap/Modal'
import { toDecimals, maxAllowance, fromDecimals, getBalanceOfAsset, isEther, formatDate } from '../../util/constants'
import { checkTransactionIsMined, getNextNonce } from '../../util/web3Methods'
import Web3Utils from 'web3-utils'
import StepsModal from '../StepsModal/StepsModal'
import DecimalInput from '../Util/DecimalInput'
import { allowDeposit, allowance } from '../../util/erc20Methods'
import MetamaskLargeIcon from '../Util/MetamaskLargeIcon'
import SpinnerLargeIcon from '../Util/SpinnerLargeIcon'
import DoneLargeIcon from '../Util/DoneLargeIcon'
import ErrorLargeIcon from '../Util/ErrorLargeIcon'
import { deposit } from '../../util/acoPoolMethods'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faSpinner } from '@fortawesome/free-solid-svg-icons'

class DepositModal extends Component {
  constructor(props) {
    super(props)
    this.state = { 
      depositValue: "",
      depositAssetBalance: "",
      loading: true
    }
  }

  componentDidMount = () => {
    getBalanceOfAsset(this.getDepositAsset(), this.context.web3.selectedAccount).then((balance) => {
      this.setState({depositAssetBalance: balance, loading: false})
    })
  }

  componentDidUpdate = (prevProps) => {
    if (this.props.accountToggle !== prevProps.accountToggle) {
      this.props.onHide(false)
    }
  }

  getDepositAsset = () => {
    return this.props.pool.isCall ? this.props.pool.underlying : this.props.pool.strikeAsset
  }

  getDepositAssetValue = () => {
    return toDecimals(this.state.depositValue, this.getDepositAssetDecimals())
  }

  getDepositAssetDecimals = () => {
    return this.props.pool.isCall ? this.props.pool.underlyingInfo.decimals : this.props.pool.strikeAssetInfo.decimals
  }

  getDepositAssetSymbol = () => {
    return this.props.pool.isCall ? this.props.pool.underlyingInfo.symbol : this.props.pool.strikeAssetInfo.symbol
  }

  onDepositClick = () => {
    if (this.canDeposit()) {
      getNextNonce(this.context.web3.selectedAccount).then(nonce => {
        var stepNumber = 0
        this.needApprove().then(needApproval => {
          if (needApproval) {
            this.setStepsModalInfo(++stepNumber, needApproval)
            allowDeposit(this.context.web3.selectedAccount, maxAllowance, this.getDepositAsset(), this.props.pool.acoPool, nonce)
              .then(result => {
                if (result) {
                  this.setStepsModalInfo(++stepNumber, needApproval)
                  checkTransactionIsMined(result).then(result => {
                    if (result) {
                      this.sendDepositTransaction(stepNumber, ++nonce, needApproval)
                    }
                    else {
                      this.setStepsModalInfo(-1, needApproval)
                    }
                  })
                    .catch(() => {
                      this.setStepsModalInfo(-1, needApproval)
                    })
                }
                else {
                  this.setStepsModalInfo(-1, needApproval)
                }
              })
              .catch(() => {
                this.setStepsModalInfo(-1, needApproval)
              })
          }
          else {
            stepNumber = 2
            this.sendDepositTransaction(stepNumber, nonce, needApproval)
          }
        })
      })
    }
  }

  sendDepositTransaction = (stepNumber, nonce, needApproval) => {
    this.setStepsModalInfo(++stepNumber, needApproval)
    deposit(this.context.web3.selectedAccount, this.props.pool.acoPool, this.getDepositAssetValue(), isEther(this.getDepositAsset()),  nonce)
      .then(result => {
        if (result) {
          this.setStepsModalInfo(++stepNumber, needApproval)
          checkTransactionIsMined(result)
            .then(result => {
              if (result) {
                this.setStepsModalInfo(++stepNumber, needApproval)
              }
              else {
                this.setStepsModalInfo(-1, needApproval)
              }
            })
            .catch(() => {
              this.setStepsModalInfo(-1, needApproval)
            })
        }
        else {
          this.setStepsModalInfo(-1, needApproval)
        }
      })
      .catch(() => {
        this.setStepsModalInfo(-1, needApproval)
      })
  }

  setStepsModalInfo = (stepNumber, needApproval) => {
    var title = (needApproval && stepNumber <= 2) ? "Unlock token" : "Deposit"
    var subtitle = ""
    var img = null
    var depositAssetSymbol =  this.getDepositAssetSymbol()
    if (needApproval && stepNumber === 1) {
      subtitle = "Confirm on Metamask to unlock " + depositAssetSymbol + "."
      img = <MetamaskLargeIcon />
    }
    else if (needApproval && stepNumber === 2) {
      subtitle = "Unlocking " + depositAssetSymbol + "..."
      img = <SpinnerLargeIcon />
    }
    else if (stepNumber === 3) {
      subtitle = "Confirm on Metamask to deposit " + this.state.depositValue + " " + depositAssetSymbol  + "."
      img = <MetamaskLargeIcon />
    }
    else if (stepNumber === 4) {
      subtitle = "Sending " + this.state.depositValue + " " + depositAssetSymbol + "..."
      img = <SpinnerLargeIcon />
    }
    else if (stepNumber === 5) {
      subtitle = "You have successfully deposited."
      img = <DoneLargeIcon />
    }
    else if (stepNumber === -1) {
      subtitle = "An error ocurred. Please try again."
      img = <ErrorLargeIcon />
    }

    var steps = []
    if (needApproval) {
      steps.push({ title: "Unlock", progress: stepNumber > 2 ? 100 : 0, active: true })
    }
    steps.push({ title: "Deposit", progress: stepNumber > 4 ? 100 : 0, active: stepNumber >= 3 ? true : false })
    this.setState({
      stepsModalInfo: {
        title: title,
        subtitle: subtitle,
        steps: steps,
        img: img,
        isDone: (stepNumber === 5 || stepNumber === -1),
        onDoneButtonClick: (stepNumber === 5 ? this.onDoneButtonClick : this.onHideStepsModal)
      }
    })
  }  

  onDoneButtonClick = () => {
    this.setState({ stepsModalInfo: null })    
    this.props.onHide(true)
  }

  onHideStepsModal = () => {
    this.setState({ stepsModalInfo: null })
  }

  needApprove = () => {
    return new Promise((resolve) => {
      if (!isEther(this.getDepositAsset())) {
        allowance(this.context.web3.selectedAccount, this.getDepositAsset(), this.props.pool.acoPool).then(result => {
          var resultValue = new Web3Utils.BN(result)
          resolve(resultValue.lt(this.getDepositAssetValue()))
        })
      }
      else {
        resolve(false)
      }
    })
  }

  getButtonMessage = () => {
    if (!this.state.depositValue || this.state.depositValue <= 0) {
      return "Enter an amount"
    }
    if (this.isInsufficientFunds()) {
      return "Insufficient funds"
    }    
    return null
  }

  canDeposit = () => {
    return (this.getButtonMessage() === null)
  }

  isInsufficientFunds = () => {
    return this.getDepositAssetValue().gt(new Web3Utils.BN(this.state.depositAssetBalance))
  }

  onMaxClick = () => {
    var balance = this.getDepositAssetBalanceFromDecimals()
    this.onValueChange(balance)
  }

  onValueChange = (value) => {
    this.setState({ depositValue: value })
  }

  getFormattedDepositAssetBalance = () => {
    return this.getDepositAssetBalanceFromDecimals() + " " + this.getDepositAssetSymbol()
  }

  getDepositAssetBalanceFromDecimals = () => {
    return fromDecimals(this.state.depositAssetBalance, this.getDepositAssetDecimals())
  }

  getPoolSummaryMessage = () => {
    let pool = this.props.pool
    let strikeRange = fromDecimals(pool.minStrikePrice, pool.strikeAssetInfo.decimals, 4, 0) +
      " "+pool.strikeAssetInfo.symbol +
      " and " +
      fromDecimals(pool.maxStrikePrice, pool.strikeAssetInfo.decimals, 4, 0) +
      " "+pool.strikeAssetInfo.symbol
    return <div className="pool-summary">This pool automatically sells {pool.isCall ? "CALL" : "PUT"} options with strike price between {strikeRange} and expiration date between {formatDate(pool.minExpiration, true)} and {formatDate(pool.maxExpiration, true)}.</div>
  }

  getPoolWarningMessage = () => {
  return <div className="pool-warning">Attention: Withdrawals will not be available until the end date of the pool on {formatDate(this.props.pool.maxExpiration, true)}.</div>
  }

  render() {
    return (<Modal className="aco-modal sell-modal deposit-modal" centered={true} show={true} onHide={() => this.props.onHide(false)}>
      <Modal.Header closeButton>DEPOSIT</Modal.Header>
      <Modal.Body>
      <div className="exercise-action">
          <div className="confirm-card">
            <div className="confirm-card-header">
              {this.getPoolSummaryMessage()}
            </div>
            <div className={"confirm-card-body " + (this.isInsufficientFunds() ? "insufficient-funds-error" : "")}>
              <div className="balance-column">
                <div>Amount available to deposit: <span>{this.state.loading ? <FontAwesomeIcon icon={faSpinner} className="fa-spin"/> : this.getFormattedDepositAssetBalance()}</span></div>
              </div>
              <div className="card-separator"></div>
              <div className="input-row">
                <div className="input-column">
                  <div className="input-label">Amount</div>
                  <div className="input-field">
                    <DecimalInput tabIndex="-1" onChange={this.onValueChange} value={this.state.depositValue}></DecimalInput>
                    <div className="max-btn" onClick={this.onMaxClick}>MAX</div>
                  </div>
                </div>
              </div>
              {this.getPoolWarningMessage()}
            </div>
            <div className="confirm-card-actions">
              <div className="aco-button cancel-btn" onClick={() => this.props.onHide(false)}>Go back</div>
              <div className={"aco-button action-btn " + (this.canDeposit() ? "" : "disabled")} onClick={this.onDepositClick}>Confirm</div>
            </div>
          </div>
          {this.state.stepsModalInfo && <StepsModal {...this.state.stepsModalInfo} onHide={this.onHideStepsModal}></StepsModal>}
        </div>
      </Modal.Body>
      </Modal>)
  }
}

DepositModal.contextTypes = {
  web3: PropTypes.object
}
export default withRouter(DepositModal)