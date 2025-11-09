import { screen } from '@testing-library/react'
import RoleGate from '@/components/RoleGate'
import { renderWithProviders } from './testUtils'

describe('RoleGate', () => {
  it('renders children when user has required role', () => {
    renderWithProviders(
      <RoleGate roles={['admin']} userRoles={['admin']}>
        <span>allowed</span>
      </RoleGate>,
    )
    expect(screen.getByText('allowed')).toBeInTheDocument()
  })

  it('hides children when user lacks required role', () => {
    renderWithProviders(
      <RoleGate roles={['admin']} userRoles={['alumno']}>
        <span>forbidden</span>
      </RoleGate>,
    )
    expect(screen.queryByText('forbidden')).not.toBeInTheDocument()
  })

  it('supports multiple roles', () => {
    renderWithProviders(
      <RoleGate roles={['admin', 'secretaria']} userRoles={['secretaria']}>
        <span>secretaria content</span>
      </RoleGate>,
    )
    expect(screen.getByText('secretaria content')).toBeVisible()
  })
})
