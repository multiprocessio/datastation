package orc

type PositionRecorders []PositionRecorder

type PositionRecorder interface {
	Positions() []uint64
}

func NewPositionRecorders(recorders ...PositionRecorder) PositionRecorders {
	return PositionRecorders(recorders)
}
