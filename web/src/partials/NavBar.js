import './NavBar.css'
import React, { Component } from 'react'
import PropTypes from 'prop-types'
import { Link, NavLink } from 'react-router-dom'
import { withRouter } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faExternalLinkAlt, faSignOutAlt } from '@fortawesome/free-solid-svg-icons'
import { etherscanUrl, ellipsisCenterOfUsername, getPairIdFromRoute } from '../util/constants'
import PairDropdown from './PairDropdown'
import { listPairs } from '../util/acoFactoryMethods'

class NavBar extends Component {
  constructor(props){
    super(props)
		this.state = {
      pairs: null,
      showAdvancedTootlip: false
    }
  }

  componentDidMount = () => {
    if (this.context && this.context.web3 && this.context.web3.validNetwork) {
      listPairs().then(pairs => {
        this.setState({pairs:pairs})
        this.props.onPairsLoaded(pairs)
      })
    }
  }

  componentDidUpdate = (prevProps) => {
    if (this.props.toggleAdvancedTooltip !== prevProps.toggleAdvancedTooltip) {
      this.setState({showAdvancedTootlip: !window.localStorage.getItem('DISMISS_ADVANCED_TOOLTIP')})
    }
  }

  isAdvanced = () => {
    return window.location.pathname.indexOf("advanced") > 0
  }

  onDismissAdvancedTooltip = () => {
    this.setState({showAdvancedTootlip: false})
    window.localStorage.setItem('DISMISS_ADVANCED_TOOLTIP', '1')
  }

  changeMode = () => {
    var url = ""
    if (window.location.pathname.indexOf("buy") > 0) {
      url = "/advanced/trade"
    } else if (window.location.pathname.indexOf("write") > 0) {
      url = "/advanced/mint"
    } else if (window.location.pathname.indexOf("manage") > 0) {
      url = "/advanced/exercise"
    } else if (window.location.pathname.indexOf("trade") > 0) {
      url = "/buy"
    } else if (window.location.pathname.indexOf("mint") > 0) {
      url = "/write"
    } else if (window.location.pathname.indexOf("exercise") > 0) {
      url = "/manage"
    } else if (window.location.pathname.indexOf("advanced/pools") > 0) {
      url = "/pools"
    } else if (window.location.pathname.indexOf("pools") > 0) {
      url = "/advanced/pools"
    }

    url = this.getUrlWithPairId(url)
    
    if (this.context && this.context.web3 && this.context.web3.selectedAccount && this.context.web3.validNetwork) {
      this.props.history.push(url)
    }
    else {
      this.props.signIn(url, this.context)
    }
  }

  getUrlWithPairId = (baseUrl) => {
    var pairId = getPairIdFromRoute(this.props.location)
    if (pairId) {
      return baseUrl + "/" + pairId
    }
    return baseUrl
  }
 
  render() {
    var username = this.context && this.context.web3 && this.context.web3.selectedAccount
    var validNetwork = this.context && this.context.web3 && this.context.web3.validNetwork
    username = ellipsisCenterOfUsername(username)
    return (
      <div>
        <nav className="navbar navbar-expand-lg navbar-dark navbar-aco">
          <div className="container-fluid">
            <div className="nav-logo logo-link">
              <Link to={`/`}>
                <img src="/logo.svg" className="aco-logo" alt="" />
              </Link>
              <a className="by-auctus-link" target="_blank" rel="noopener noreferrer" href="https://auctus.org">
                <img src="/logo_by_auctus.svg" className="by-auctus-logo" alt="" />
              </a>
            </div>
            <button className="navbar-toggler" type="button" data-toggle="collapse" data-target="#navbarResponsive" aria-controls="navbarResponsive" aria-expanded="false" aria-label="Toggle navigation">
              <span className="navbar-toggler-icon"></span>
            </button>
            <div className="collapse navbar-collapse" id="navbarResponsive">
              {this.isAdvanced() && 
              <ul className="navbar-nav">
                <PairDropdown {...this.props} pairs={this.state.pairs}></PairDropdown>
              </ul>}
              {this.isAdvanced() && 
              <ul className="navbar-nav mx-auto mt-2 mt-lg-0 navbar-items">
                <NavLink className="nav-item link-nav" to={this.getUrlWithPairId("/advanced/trade")}>Trade</NavLink>
                <NavLink className="nav-item link-nav" to={this.getUrlWithPairId("/advanced/mint")}>Mint</NavLink>
                <NavLink className="nav-item link-nav" to={this.getUrlWithPairId("/advanced/exercise")}>Exercise</NavLink>
                <NavLink className="nav-item link-nav" to={this.getUrlWithPairId("/advanced/pools")}>Pools</NavLink>
              </ul>}
              <ul className="navbar-nav nav-modes ml-auto">
                <div className="app-mode active">{this.isAdvanced() ? "Advanced" : "Basic"}</div>
                <div className="app-mode" onClick={() => this.changeMode()}>{this.isAdvanced() ? "Basic" : "Advanced"}<FontAwesomeIcon icon={faExternalLinkAlt} /></div>
                {this.state.showAdvancedTootlip && window.innerWidth >= 992 && !this.isAdvanced() &&
                <div className="advanced-tooltip">
                  Go to advanced mode to trade options with limit orders.
                  <div className="action-btn" onClick={() => this.onDismissAdvancedTooltip()}>Dismiss</div>
                </div>}
              </ul>
              <ul className="navbar-nav">
                {username &&
                  <li className="nav-item dropdown metamask">                  
                    <div className="dropdown-toggle nav-link clickable" target="_self" id="navbarProfile" role="button" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false">
                      <div className="user-nav-container">
                        <div className="user-nav-wrap">
                          <img src="/images/icon_metamask.png" alt=""></img>
                          <div>
                            <span className="wallet-address">{username}</span>
                            {validNetwork && <span className="connected-label">Connected</span>}
                            {!validNetwork && <span className="invalid-network-label">Incorrect Network</span>}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="dropdown-menu" aria-labelledby="navbarProfile">
                      <a className="dropdown-item clickable" rel="noopener noreferrer" href={etherscanUrl + this.context.web3.selectedAccount} target="_blank"><FontAwesomeIcon icon={faExternalLinkAlt}></FontAwesomeIcon>&nbsp;OPEN IN ETHERSCAN</a>
                      <div className="dropdown-divider"></div>
                      <div className="dropdown-item clickable" target="_self" onClick={() => this.props.signOut()}><FontAwesomeIcon icon={faSignOutAlt}></FontAwesomeIcon>&nbsp;SIGN OUT</div>
                    </div>
                  </li>
                }
                {!username && 
                  <li className="nav-item mx-lg-2">
                    <div className="nav-link link-nav underline clickable" onClick={() => this.props.signIn((this.isAdvanced() ? "/advanced/mint" : "/write"), this.context)}>CONNECT WALLET</div>
                  </li>
                }
              </ul>
            </div>
          </div>
        </nav>
      </div>)   
  }
}
NavBar.contextTypes = {
  web3: PropTypes.object,
  ticker: PropTypes.object
}
export default withRouter(NavBar)
